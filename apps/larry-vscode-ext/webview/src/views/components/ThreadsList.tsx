import type { ThreadListItem } from '../../lib/backend-types';

export function ThreadsList(props: {
  items: ThreadListItem[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const onItemSelect = (id: string) => {
    if (selectedId === id) {
      onSelect('');
    } else {
      onSelect(id);
    }
  };
  const { items, selectedId, onSelect } = props;
  if (!items.length) {
    return <div className="color-fg-muted">No threads yet.</div>;
  }
  return (
    <div className="Box overflow-auto" style={{ maxHeight: '50vh' }}>
      <ul className="list-style-none">
        {items.map((t) => (
          <li
            key={t.id}
            style={{
              backgroundColor:
                selectedId === t.id
                  ? 'var(--vscode-list-hoverBackground)'
                  : 'transparent',
              border: '1px solid var(--vscode-list-hoverBackground)',
              cursor: 'pointer',
              marginBottom: '2px',
            }}
            className={`d-flex flex-justify-between`}
          >
            <button
              className="btn-invisible text-left"
              onClick={() => onItemSelect(t.id)}
            >
              <div className="text-bold">{t.label}</div>
              <div className="color-fg-muted text-small">{t.worktreeName}</div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
