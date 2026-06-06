type FormStatusMessageProps = {
  kind: "success" | "error";
  message: string;
};

export default function FormStatusMessage({
  kind,
  message,
}: FormStatusMessageProps) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={`form-status ${
        kind === "success" ? "form-status-success" : "form-status-error"
      }`}
    >
      {message}
    </p>
  );
}
