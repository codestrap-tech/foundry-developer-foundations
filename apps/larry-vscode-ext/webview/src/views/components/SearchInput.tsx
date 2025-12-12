export function SearchInput(props: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      className="form-control input-sm"
      placeholder="Search…"
      value={props.value}
      onInput={(e) =>
        props.onChange((e.currentTarget as HTMLInputElement).value)
      }
    />
  );
}
