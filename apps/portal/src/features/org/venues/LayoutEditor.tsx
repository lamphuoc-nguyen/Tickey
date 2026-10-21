import {
  LAYOUT_TEMPLATES,
  SPACING,
  rowLabel,
  toDefinition,
  zoneCapacity,
  type EditorZone,
} from './layout-model';

export function LayoutEditor({
  zones,
  onChange,
  readOnly = false,
}: {
  zones: EditorZone[];
  onChange: (zones: EditorZone[]) => void;
  readOnly?: boolean;
}) {
  const update = (index: number, patch: Partial<EditorZone>) =>
    onChange(zones.map((zone, i) => (i === index ? { ...zone, ...patch } : zone)));
  const nextCode = () => {
    for (let i = 0; ; i++) if (!zones.some((zone) => zone.id === rowLabel(i))) return rowLabel(i);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!readOnly && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Mẫu nhanh:</span>
            {LAYOUT_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: 12 }}
                onClick={() => onChange(template.zones.map((zone) => ({ ...zone })))}
              >
                {template.label}
              </button>
            ))}
          </div>
        )}
        {zones.map((zone, index) => (
          <div
            key={index}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: 12,
              display: 'grid',
              gap: 8,
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 120px', gap: 8 }}>
              <input
                className="form-input"
                aria-label="Mã khu"
                value={zone.id}
                disabled={readOnly}
                onChange={(e) =>
                  update(index, { id: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })
                }
              />
              <input
                className="form-input"
                aria-label="Tên khu"
                value={zone.name}
                disabled={readOnly}
                onChange={(e) => update(index, { name: e.target.value })}
              />
              <select
                className="form-select"
                value={zone.type}
                disabled={readOnly}
                onChange={(e) =>
                  update(
                    index,
                    e.target.value === 'seated'
                      ? { type: 'seated', rows: zone.rows || 5, seatsPerRow: zone.seatsPerRow || 10 }
                      : { type: 'standing', capacity: zone.capacity || 100 },
                  )
                }
              >
                <option value="seated">Có ghế</option>
                <option value="standing">Khu đứng</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, flexWrap: 'wrap' }}>
              {zone.type === 'seated' ? (
                <>
                  <input
                    className="form-input"
                    type="number"
                    min={1}
                    style={{ width: 80 }}
                    value={zone.rows}
                    disabled={readOnly}
                    onChange={(e) => update(index, { rows: Number(e.target.value) })}
                  />
                  hàng ×
                  <input
                    className="form-input"
                    type="number"
                    min={1}
                    style={{ width: 80 }}
                    value={zone.seatsPerRow}
                    disabled={readOnly}
                    onChange={(e) => update(index, { seatsPerRow: Number(e.target.value) })}
                  />
                  ghế = <strong>{zoneCapacity(zone)} ghế</strong>
                </>
              ) : (
                <>
                  Sức chứa
                  <input
                    className="form-input"
                    type="number"
                    min={1}
                    style={{ width: 110 }}
                    value={zone.capacity}
                    disabled={readOnly}
                    onChange={(e) => update(index, { capacity: Number(e.target.value) })}
                  />
                  người
                </>
              )}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => onChange(zones.filter((_, i) => i !== index))}
                  style={{
                    marginLeft: 'auto',
                    background: 'none',
                    border: 'none',
                    color: '#B42318',
                    cursor: 'pointer',
                  }}
                >
                  Xóa khu
                </button>
              )}
            </div>
          </div>
        ))}
        {!readOnly && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              const id = nextCode();
              onChange([
                ...zones,
                { id, name: `Khu ${id}`, type: 'seated', rows: 5, seatsPerRow: 10, capacity: 0 },
              ]);
            }}
          >
            + Thêm khu vực
          </button>
        )}
      </div>
      <LayoutPreview zones={zones} />
    </div>
  );
}

/** Schematic preview: one dot per seat, standing zones as a block with their capacity. */
export function LayoutPreview({ zones }: { zones: EditorZone[] }) {
  const definition = toDefinition(zones.filter((zone) => zoneCapacity(zone) > 0));
  const seated = definition.zones.flatMap((zone) => (zone.type === 'seated' ? zone.seats : []));
  const width = Math.max(300, ...seated.map((seat) => seat.x + SPACING));
  const seatedHeight = Math.max(0, ...seated.map((seat) => seat.y + SPACING));
  const standing = definition.zones.filter((zone) => zone.type === 'standing');
  const height = seatedHeight + standing.length * 70 + 50;
  const total = zones.reduce((sum, zone) => sum + zoneCapacity(zone), 0);

  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
        <strong>Xem trước</strong>
        <span style={{ color: 'var(--muted)' }}>Tổng sức chứa: {total}</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', maxHeight: 420, background: '#FAF9F6', borderRadius: 8 }}
      >
        <rect x={width * 0.2} y={8} width={width * 0.6} height={22} rx={6} fill="#1F2937" />
        <text x={width / 2} y={23} textAnchor="middle" fontSize={11} fill="#FFFFFF">
          SÂN KHẤU
        </text>
        <g transform="translate(0 46)">
          {definition.zones.map((zone) =>
            zone.type === 'seated'
              ? zone.seats.map((seat) => (
                  <circle
                    key={seat.id}
                    cx={seat.x}
                    cy={seat.y}
                    r={10}
                    fill={(zone as { color?: string }).color}
                  >
                    <title>{`${zone.name} · ${seat.row}${seat.number}`}</title>
                  </circle>
                ))
              : null,
          )}
          {standing.map((zone, index) => (
            <g key={zone.id} transform={`translate(${SPACING} ${seatedHeight + index * 70})`}>
              <rect
                width={width - SPACING * 2}
                height={56}
                rx={10}
                fill={(zone as { color?: string }).color}
                opacity={0.85}
              />
              <text x={(width - SPACING * 2) / 2} y={33} textAnchor="middle" fontSize={14} fill="#FFFFFF">
                {zone.name} · {zone.capacity} chỗ đứng
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
