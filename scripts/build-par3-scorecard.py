"""Build the blank A4 player handout. Requires reportlab; no player data is used."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor
from reportlab.lib.units import mm

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output/pdf/par3-match-scorecard.pdf"
OUT.parent.mkdir(parents=True, exist_ok=True)
INK = HexColor("#14232e")
MUTED = HexColor("#344e5e")
LINE = HexColor("#8fa5b1")
CYAN = HexColor("#08708d")
GOLD = HexColor("#ffbd18")
c = canvas.Canvas(str(OUT), pagesize=A4)
c.setTitle("CGS Par 3 Championship II - Player match scorecard")
c.setAuthor("Crossodog Golf Society")

def text(x, y, value, size=11, bold=False, color=INK):
    c.setFillColor(color)
    c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
    c.drawString(x * mm, y * mm, value)

def line(x1, y1, x2, y2, color=LINE, width=.65):
    c.setStrokeColor(color)
    c.setLineWidth(width)
    c.line(x1 * mm, y1 * mm, x2 * mm, y2 * mm)

def field(x, y, label, width):
    text(x, y, label, 16, True, INK)
    line(x, y-22, x+width, y-22)

c.setFillColor(CYAN)
c.rect(14*mm, 279*mm, 123*mm, 3*mm, fill=1, stroke=0)
c.setFillColor(GOLD)
c.rect(137*mm, 279*mm, 59*mm, 3*mm, fill=1, stroke=0)
text(14, 270, "CGS PAR 3 CHAMPIONSHIP II", 12, True, CYAN)
text(14, 258, "MATCH RESULT", 23, True)
field(14, 230, "Player A", 182)
field(14, 170, "Player B", 182)
field(14, 110, "Winner & Score", 182)
c.showPage()
c.save()
target = ROOT / "public/par3/par3-match-scorecard.pdf"
target.write_bytes(OUT.read_bytes())
print(f"Built one A4 scorecard: {OUT}")
