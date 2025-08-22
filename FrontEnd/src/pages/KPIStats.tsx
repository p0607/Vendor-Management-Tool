import React, { useState } from "react";
import { formatAmountInCrores } from "../utils/formatUtils";

interface ReportData {
  particulars: string;
  amount: number;
}

interface KPIStatsProps {
  data: ReportData[];
}

const targetFields = ["REVENUE", "GPM", "TEAM COST", "NET MARGIN"];

const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: "16px",
  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
  padding: "32px 0",
  minWidth: 140,
  minHeight: 120,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  transition: "transform 0.2s, box-shadow 0.2s",
  cursor: "pointer",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "24px",
  marginBottom: "32px",
};

const KPIStats: React.FC<KPIStatsProps> = ({ data }) => {
  const [hovered, setHovered] = useState<string | null>(null);

  // Calculate totals from filtered data prop
  const totals = data.reduce<Record<string, number>>((acc, { particulars, amount }) => {
    const key = particulars.toUpperCase();
    if (targetFields.includes(key)) {
      acc[key] = (acc[key] || 0) + Number(amount);
    }
    return acc;
  }, {});

  return (
    <div style={gridStyle}>
      {targetFields.map((key) => (
        <div
          key={key}
          style={{
            ...cardStyle,
            transform: hovered === key ? "translateY(-8px) scale(1.04)" : "none",
            boxShadow:
              hovered === key
                ? "0 8px 24px rgba(0,0,0,0.16)"
                : cardStyle.boxShadow,
          }}
          onMouseEnter={() => setHovered(key)}
          onMouseLeave={() => setHovered(null)}
        >
          <span style={{ fontSize: 18, fontWeight: 600, color: "#6B7280", marginBottom: 8 }}>
            {key}
          </span>
          <span style={{ fontSize: 26, fontWeight: 700, color: "#2563EB" }}>
            {formatAmountInCrores(totals[key] || 0)}
          </span>
        </div>
      ))}
    </div>
  );
};

export default KPIStats;