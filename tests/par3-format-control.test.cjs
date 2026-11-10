const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

function compile(relative, overrides = {}) {
  const filename = path.resolve(__dirname, "..", relative);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded.require = (name) => Object.hasOwn(overrides, name) ? overrides[name] : module.require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return loaded.exports;
}

const rules = compile("lib/par3-showdown-types.ts");
const defaults = {
  eventId: 1,
  initialPoolSizes: [4, 4, 4, 4, 4],
  initialFinalsSize: 16,
  assignedCounts: [3, 3, 3, 3, 3],
  activePlayerCount: 15,
  locked: false,
  lockReason: "Pool play has started. Recorded results are protected.",
  allocationLocked: false,
};

function renderFormat(props = {}, currentMode) {
  const react = currentMode === undefined ? React : {
    ...React,
    // Render the state after selecting a different mode while retaining the
    // saved initial props, so the real unsaved/locking/error logic is exercised.
    useState(initial) {
      const state = React.useState(initial);
      return initial === "standard" || initial === "pool_winners_ctp_bye" ? [currentMode, state[1]] : state;
    },
  };
  const Control = compile("components/admin/Par3FormatControl.tsx", {
    react,
    "react-dom": { useFormStatus: () => ({ pending: false }) },
    "@/lib/par3-showdown-types": rules,
  }).default;
  return renderToStaticMarkup(React.createElement(Control, { ...defaults, ...props }));
}

function interactiveFormat(props = {}) {
  const values = [];
  let cursor = 0;
  let tree;
  let currentProps = { ...defaults, ...props };
  let mountedType;
  let mountedKey;
  let mountCount = 0;
  const Control = compile("components/admin/Par3FormatControl.tsx", {
    react: {
      ...React,
      useState(initial) {
        const index = cursor++;
        if (!(index in values)) values[index] = typeof initial === "function" ? initial() : initial;
        return [values[index], (next) => { values[index] = typeof next === "function" ? next(values[index]) : next; }];
      },
    },
    "react-dom": { useFormStatus: () => ({ pending: false }) },
    "@/lib/par3-showdown-types": rules,
  }).default;
  function find(node, predicate) {
    if (Array.isArray(node)) return node.map((child) => find(child, predicate)).find(Boolean);
    if (!React.isValidElement(node)) return null;
    return predicate(node) ? node : find(node.props.children, predicate);
  }
  return {
    render() {
      cursor = 0;
      return renderToStaticMarkup(React.createElement(function FormatStateHarness() {
        tree = Control(currentProps);
        // Follow the actual keyed editor returned by the public component.
        // Preserve state between renders of that editor, and discard it when
        // its React type/key changes, as React reconciliation does in-browser.
        while (React.isValidElement(tree) && typeof tree.type === "function") {
          if (tree.type !== mountedType || tree.key !== mountedKey) {
            values.length = 0;
            mountedType = tree.type;
            mountedKey = tree.key;
            mountCount += 1;
          }
          tree = tree.type(tree.props);
        }
        return tree;
      }));
    },
    change(id, value) {
      const input = find(tree, (node) => node.props.id === id);
      assert.ok(input, `missing control ${id}`);
      assert.equal(typeof input.props.onChange, "function");
      input.props.onChange({ target: { value: String(value) } });
      return this.render();
    },
    setProps(next) {
      currentProps = { ...currentProps, ...next };
      return this.render();
    },
    value(id) {
      const input = find(tree, (node) => node.props.id === id);
      assert.ok(input, `missing control ${id}`);
      return input.props.value;
    },
    mountCount: () => mountCount,
  };
}

function fieldset(html, controlId) {
  const fieldsets = [...html.matchAll(/<fieldset([^>]*)>(.*?)<\/fieldset>/gs)];
  const result = fieldsets.find((match) => match[2].includes(`id="${controlId}"`));
  assert.ok(result, `missing fieldset for ${controlId}`);
  return { disabled: /(?:^|\s)disabled(?:=""|\s|$)/.test(result[1]), content: result[2] };
}

function buttonDisabled(html, label) {
  const match = [...html.matchAll(/<button([^>]*)>(.*?)<\/button>/gs)].find((button) => button[2] === label);
  assert.ok(match, `missing ${label} button`);
  return /(?:^|\s)disabled(?:=""|\s|$)/.test(match[1]);
}

test("the saved fifteen-player format explains all five CTP winners, one quarter-final bye and seven matches", () => {
  const html = renderFormat({ initialPoolSizes: [3, 3, 3, 3, 3], initialFinalsFormat: "pool_winners_ctp_bye" });
  assert.match(html, /All 5 pool winners contest CTP/);
  assert.match(html, /other 14 entrants play 7 matches/);
  assert.match(html, /CTP winner into the quarter-finals \+ seven opening matches/);
  assert.match(html, /15 finalists \+ 1 bye/);
  assert.match(html, /name="finals_format" value="pool_winners_ctp_bye"/);
  assert.ok(!/<ul[^>]*role="status"/.test(html), "a valid fifteen-player configuration must not display a format error");
});

test("pool play can lock structure while allowing a valid mode-only change without changing pools or bracket size", () => {
  const html = renderFormat({ locked: true, finalsFormatLocked: false, allocationLocked: true }, "pool_winners_ctp_bye");
  assert.equal(fieldset(html, "par3-pool-count").disabled, true);
  assert.equal(fieldset(html, "par3-capacity-0").disabled, true);
  assert.equal(fieldset(html, "par3-finals-format").disabled, false);
  assert.equal(buttonDisabled(html, "Save tournament format"), false);
  assert.equal(buttonDisabled(html, "Allocate players"), true);
  assert.match(html, /name="pool_sizes" value="\[4,4,4,4,4\]"/);
  assert.match(html, /name="finals_size" value="16"/);
  assert.match(html, /keeping the same pools and bracket size/);
});

test("fourteen or sixteen actual entrants block a new fifteen-player bye format even when its capacity is sufficient", () => {
  for (const count of [14, 16]) {
    const html = renderFormat({ activePlayerCount: count, locked: true, finalsFormatLocked: false, allocationLocked: true }, "pool_winners_ctp_bye");
    assert.match(html, /needs exactly 15 active entrants for a 16-slot bracket/);
    assert.ok(html.includes(`There are currently ${count}.`));
    assert.match(html, /role="status"/);
    assert.equal(buttonDisabled(html, "Save tournament format"), true);
    assert.equal(fieldset(html, "par3-finals-format").disabled, false, "the organiser must still be able to choose another valid mode");
  }
});

test("confirmed CTP/finals locks prevent mode changes as well as structural changes", () => {
  const html = renderFormat({ locked: true, finalsFormatLocked: true, allocationLocked: true }, "pool_winners_ctp_bye");
  assert.equal(fieldset(html, "par3-finals-format").disabled, true);
  assert.equal(fieldset(html, "par3-pool-count").disabled, true);
  assert.equal(buttonDisabled(html, "Save tournament format"), true);
  assert.match(html, /Clear the confirmed CTP selection before changing this setting/);
});

test("omitting the new mode keeps the existing standard format and labels its figures as capacity", () => {
  const html = renderFormat();
  assert.match(html, /name="finals_format" value="standard"/);
  assert.match(html, /3 automatic places per pool \+ 1 CTP places/);
  assert.match(html, /16 finalists/);
  assert.match(html, /30 pool matches at capacity/);
  assert.match(html, /Draw uses actual assigned players/);
  assert.ok(!html.includes("15 finalists + 1 bye"));
  assert.equal(buttonDisabled(html, "Save tournament format"), true, "an unchanged saved format does not need another write");
});

test("the separate calculator is explicitly a preview and never enables saving or allocation", () => {
  const html = renderFormat({ previewOnly: true, activePlayerCount: 0, assignedCounts: [] }, "pool_winners_ctp_bye");
  assert.match(html, /Calculator preview/);
  assert.match(html, /changes are not saved and no players or results are loaded/);
  assert.match(html, /15 finalists \+ 1 bye/);
  assert.ok(!html.includes("There are currently 0."), "a capacity calculator must not pretend its empty roster is a live field error");
  assert.equal(buttonDisabled(html, "Save tournament format"), true);
  assert.equal(buttonDisabled(html, "Allocate players"), true);
});

test("changing four pools to five and back immediately recalculates capacities, matches, qualification and submitted fields", () => {
  const h = interactiveFormat({ initialPoolSizes: [4, 4, 4, 4], assignedCounts: [0, 0, 0, 0], activePlayerCount: 0 });
  let html = h.render();
  assert.match(html, /16 places/);
  assert.match(html, /24 pool matches at capacity/);
  assert.match(html, /4 automatic places per pool \+ 0 CTP places/);
  assert.ok(!html.includes('id="par3-capacity-4"'));
  assert.equal(buttonDisabled(html, "Save tournament format"), true);

  html = h.change("par3-pool-count", 5);
  assert.match(html, /20 places/);
  assert.match(html, /30 pool matches at capacity/);
  assert.match(html, /3 automatic places per pool \+ 1 CTP places/);
  assert.match(html, /id="par3-capacity-4"/);
  assert.match(html, /name="pool_sizes" value="\[4,4,4,4,4\]"/);
  assert.equal(buttonDisabled(html, "Save tournament format"), false);

  html = h.change("par3-pool-count", 4);
  assert.match(html, /16 places/);
  assert.match(html, /24 pool matches at capacity/);
  assert.match(html, /4 automatic places per pool \+ 0 CTP places/);
  assert.ok(!html.includes('id="par3-capacity-4"'));
  assert.match(html, /name="pool_sizes" value="\[4,4,4,4\]"/);
  assert.equal(buttonDisabled(html, "Save tournament format"), true);
});

test("adding a fifth pool retains existing individual capacities and uses the nominated default for its new places", () => {
  const h = interactiveFormat({ initialPoolSizes: [2, 3, 4, 5], initialFinalsSize: 8, assignedCounts: [], activePlayerCount: 0 });
  h.render();
  h.change("par3-default-size", 3);
  h.change("par3-capacity-0", 2);
  h.change("par3-capacity-2", 4);
  h.change("par3-capacity-3", 5);
  let html = h.change("par3-pool-count", 5);
  assert.match(html, /name="pool_sizes" value="\[2,3,4,5,3\]"/);
  assert.match(html, /17 places/);
  assert.match(html, /23 pool matches at capacity/);
  html = h.change("par3-capacity-4", 6);
  assert.match(html, /name="pool_sizes" value="\[2,3,4,5,6\]"/);
  assert.match(html, /20 places/);
  html = h.change("par3-pool-count", 4);
  assert.match(html, /name="pool_sizes" value="\[2,3,4,5\]"/);
  assert.match(html, /14 places/);
});

test("a refreshed saved format remounts the editor from four pools to five and back, clearing stale local state", () => {
  const h = interactiveFormat({ initialPoolSizes: [4, 4, 4, 4], assignedCounts: [], activePlayerCount: 0 });
  let html = h.render();
  assert.match(html, /Saved format: 4 pools/);
  assert.equal(h.mountCount(), 1);

  html = h.setProps({ initialPoolSizes: [4, 4, 4, 4, 4] });
  assert.match(html, /Saved format: 5 pools/);
  assert.match(html, /name="pool_sizes" value="\[4,4,4,4,4\]"/);
  assert.match(html, /id="par3-capacity-4"/);
  assert.match(html, /20 places/);
  assert.equal(buttonDisabled(html, "Save tournament format"), true);
  assert.equal(h.mountCount(), 2);

  html = h.setProps({ initialPoolSizes: [4, 4, 4, 4] });
  assert.match(html, /Saved format: 4 pools/);
  assert.match(html, /name="pool_sizes" value="\[4,4,4,4\]"/);
  assert.ok(!html.includes('id="par3-capacity-4"'));
  assert.equal(h.mountCount(), 3);
});

test("a failed save or roster refresh preserves the draft until the saved format actually changes", () => {
  const h = interactiveFormat({ initialPoolSizes: [4, 4, 4, 4], assignedCounts: [], activePlayerCount: 0 });
  h.render();
  let html = h.change("par3-pool-count", 5);
  assert.match(html, /Unsaved preview: 5 pools/);
  assert.match(html, /live tournament still has 4 pools/);
  assert.equal(h.mountCount(), 1);
  assert.equal(buttonDisabled(html, "Save and update tournament"), false);

  html = h.setProps({ initialPoolSizes: [4, 4, 4, 4], assignedCounts: [1, 0, 0, 0], activePlayerCount: 1 });
  assert.match(html, /Unsaved preview: 5 pools/);
  assert.match(html, /name="pool_sizes" value="\[4,4,4,4,4\]"/);
  assert.equal(h.mountCount(), 1, "equal saved format values must retain the same editor even when a new array arrives");

  html = h.setProps({ initialPoolSizes: [4, 4, 4, 4, 4] });
  assert.match(html, /Saved format: 5 pools/);
  assert.ok(!html.includes("Unsaved preview"));
  assert.equal(buttonDisabled(html, "Save tournament format"), true);
  assert.equal(h.mountCount(), 2);
});

test("changing places per pool to three immediately updates every pool, submitted capacities and the saved refresh", () => {
  const h = interactiveFormat({ initialFinalsFormat: "pool_winners_ctp_bye" });
  h.render();
  let html = h.change("par3-default-size", 3);
  assert.equal(String(h.value("par3-default-size")), "3");
  for (let index = 0; index < 5; index += 1) assert.equal(h.value(`par3-capacity-${index}`), 3);
  assert.match(html, /name="pool_sizes" value="\[3,3,3,3,3\]"/);
  assert.match(html, /15 places/);
  assert.match(html, /15 pool matches at capacity/);
  assert.match(html, /15 finalists \+ 1 bye/);
  assert.equal(buttonDisabled(html, "Save and update tournament"), false);
  assert.ok(!/<ul[^>]*role="status"/.test(html));

  html = h.setProps({ initialPoolSizes: [3, 3, 3, 3, 3] });
  assert.equal(String(h.value("par3-default-size")), "3", "the global value must reflect the returned saved capacities after a successful save");
  for (let index = 0; index < 5; index += 1) assert.equal(h.value(`par3-capacity-${index}`), 3);
  assert.match(html, /Saved format: 5 pools/);
  assert.ok(!html.includes("Unsaved preview"));
  assert.equal(buttonDisabled(html, "Save tournament format"), true);
});

test("individual pool overrides remain editable after applying the global size and new pools inherit that size", () => {
  const h = interactiveFormat({ initialFinalsFormat: "pool_winners_ctp_bye" });
  h.render();
  h.change("par3-default-size", 3);
  let html = h.change("par3-capacity-0", 4);
  assert.equal(h.value("par3-default-size"), "mixed", "a single pool override must not claim all pools use the same size");
  assert.match(html, /name="pool_sizes" value="\[4,3,3,3,3\]"/);
  assert.equal(h.value("par3-capacity-0"), 4);
  for (let index = 1; index < 5; index += 1) assert.equal(h.value(`par3-capacity-${index}`), 3);
  html = h.change("par3-pool-count", 6);
  assert.match(html, /name="pool_sizes" value="\[4,3,3,3,3,3\]"/);
  assert.equal(h.value("par3-capacity-5"), 3);
  html = h.change("par3-default-size", 3);
  assert.match(html, /name="pool_sizes" value="\[3,3,3,3,3,3\]"/);
  assert.equal(String(h.value("par3-default-size")), "3");
});

test("fifteen places require the CTP bye mode for a sixteen-slot bracket without silently changing the selected format", () => {
  const h = interactiveFormat();
  h.render();
  let html = h.change("par3-default-size", 3);
  assert.match(html, /name="pool_sizes" value="\[3,3,3,3,3\]"/);
  assert.equal(h.value("par3-finals-format"), "standard");
  assert.match(html, /no larger than the player capacity/);
  assert.equal(buttonDisabled(html, "Save and update tournament"), true);

  html = h.change("par3-finals-format", "pool_winners_ctp_bye");
  assert.match(html, /name="pool_sizes" value="\[3,3,3,3,3\]"/);
  assert.match(html, /name="finals_format" value="pool_winners_ctp_bye"/);
  assert.ok(!/<ul[^>]*role="status"/.test(html));
  assert.equal(buttonDisabled(html, "Save and update tournament"), false);
});

test("a global capacity reduction protects a pool which already has four assigned players", () => {
  const h = interactiveFormat({ initialFinalsFormat: "pool_winners_ctp_bye", assignedCounts: [4, 3, 3, 3, 2] });
  h.render();
  const html = h.change("par3-default-size", 3);
  assert.match(html, /name="pool_sizes" value="\[3,3,3,3,3\]"/);
  assert.match(html, /Pool A already has 4 players/);
  assert.equal(buttonDisabled(html, "Save and update tournament"), true);
});
