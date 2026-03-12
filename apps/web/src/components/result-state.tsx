type ResultStateProps = {
  type: "success" | "error" | "info";
  message: string;
};

export default function ResultState({ type, message }: ResultStateProps) {
  return <p className={`ui-result ui-result-${type}`}>{message}</p>;
}
