import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3-selection';
import 'd3-transition'; // Import for transition support
import { pie, arc } from 'd3-shape';
import { scaleOrdinal } from 'd3-scale';
import { useTheme } from '@mui/material';

interface PieData {
  categoryId: number;
  categoryName: string;
  amount: number;
  percentage: number;
  children?: PieData[];
}

interface DrillLevel {
  data: PieData[];
  label: string;
}

interface D3PieChartProps {
  data: PieData[];
  width?: number;
  height?: number;
}

// Sophisticated color palette - muted, professional tones
const colorPalette = [
  '#4e79a7', // steel blue
  '#f28e2c', // warm orange
  '#e15759', // soft red
  '#76b7b2', // teal
  '#59a14f', // green
  '#edc949', // gold
  '#af7aa1', // mauve
  '#ff9da7', // pink
  '#9c755f', // brown
  '#bab0ab', // gray
  '#6b9ac4', // light blue
  '#d37295', // rose
  '#8cd17d', // light green
  '#b6992d', // olive
  '#499894', // dark teal
  '#e49444', // darker orange
];

const D3PieChart: React.FC<D3PieChartProps> = ({ 
  data, 
  width = 800, 
  height = 500 
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  const [drillStack, setDrillStack] = useState<DrillLevel[]>([]);
  const [currentData, setCurrentData] = useState<PieData[]>(data);
  const [currentLabel, setCurrentLabel] = useState('Total');
  const [animPhase, setAnimPhase] = useState<'idle' | 'exit' | 'enter'>('idle');

  // Reset drill state when top-level data changes (e.g. date range change)
  useEffect(() => {
    setCurrentData(data);
    setDrillStack([]);
    setCurrentLabel('Total');
  }, [data]);

  // Use a ref so the D3 click handler always has the latest drillIn fn
  const drillInRef = useRef<(slice: PieData) => void>(() => {});

  const drillIn = useCallback((slice: PieData) => {
    if (!slice.children?.length) return;
    const total = slice.children.reduce((s, c) => s + c.amount, 0);
    const children: PieData[] = slice.children.map(c => ({
      ...c,
      percentage: total > 0 ? (c.amount / total) * 100 : 0,
    }));
    setAnimPhase('exit');
    setTimeout(() => {
      setDrillStack(prev => [...prev, { data: currentData, label: currentLabel }]);
      setCurrentData(children);
      setCurrentLabel(slice.categoryName);
      setAnimPhase('enter');
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimPhase('idle')));
    }, 220);
  }, [currentData, currentLabel]);

  useEffect(() => { drillInRef.current = drillIn; }, [drillIn]);

  const drillOut = useCallback(() => {
    if (!drillStack.length) return;
    const prevLevel = drillStack[drillStack.length - 1];
    setAnimPhase('exit');
    setTimeout(() => {
      setDrillStack(prev => prev.slice(0, -1));
      setCurrentData(prevLevel.data);
      setCurrentLabel(prevLevel.label);
      setAnimPhase('enter');
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimPhase('idle')));
    }, 220);
  }, [drillStack]);

  useEffect(() => {
    if (!currentData || !currentData.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous render

    const margin = 80; // Space for labels
    const radius = Math.min(width, height) / 2 - margin;
    const outerRadius = radius;
    const innerRadius = radius * 0.55; // Donut chart
    const labelRadius = radius + 30; // Position labels outside the chart

    // Color scale
    const color = scaleOrdinal<string>()
      .domain(currentData.map(d => d.categoryName))
      .range(colorPalette);

    // Create the pie generator - sort by value descending
    const pieGenerator = pie<PieData>()
      .value(d => d.amount)
      .sort((a, b) => b.amount - a.amount)
      .padAngle(0.01); // Small gap between slices

    // Create the arc generator for the donut
    const arcGenerator = arc<any>()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .cornerRadius(3);

    // Arc generator for hover state
    const arcHover = arc<any>()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius + 8)
      .cornerRadius(3);

    // Arc for label positioning (outside the donut)
    const labelArc = arc<any>()
      .innerRadius(labelRadius)
      .outerRadius(labelRadius);

    svg
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("style", "max-width: 100%; height: auto;");

    // Chart group - centered
    const chartG = svg.append("g")
      .attr("transform", `translate(${width / 2}, ${height / 2})`);

    const pieData = pieGenerator(currentData);

    // Add pie slices
    const slices = chartG.selectAll(".slice")
      .data(pieData)
      .enter().append("g")
      .attr("class", "slice");

    slices.append("path")
      .attr("d", arcGenerator)
      .attr("fill", d => color(d.data.categoryName))
      .attr("stroke", isDarkMode ? '#1e1e1e' : '#fff')
      .attr("stroke-width", 2)
      .style("cursor", d => (d.data.children?.length ? "pointer" : "default"))
      .style("opacity", 0.9)
      .on("mouseover", function(event, d: any) {
        // Highlight slice
        d3.select(this)
          .transition()
          .duration(200)
          .attr("d", arcHover)
          .style("opacity", 1);
        
        // Show tooltip
        const hasDrilldown = (d.data.children?.length ?? 0) > 0;
        const tooltip = d3.select("body").append("div")
          .attr("class", "d3-pie-tooltip")
          .style("position", "absolute")
          .style("background", isDarkMode ? "rgba(40, 40, 40, 0.95)" : "rgba(255, 255, 255, 0.98)")
          .style("color", isDarkMode ? "#fff" : "#333")
          .style("padding", "12px 16px")
          .style("border-radius", "8px")
          .style("font-size", "13px")
          .style("pointer-events", "none")
          .style("z-index", "9999")
          .style("box-shadow", "0 4px 20px rgba(0,0,0,0.25)")
          .style("border", `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`);

        tooltip.html(`
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
            <span style="width: 12px; height: 12px; border-radius: 3px; background: ${color(d.data.categoryName)}; display: inline-block;"></span>
            ${d.data.categoryName}
          </div>
          <div style="display: flex; justify-content: space-between; gap: 24px;">
            <span style="opacity: 0.7;">Amount</span>
            <span style="font-weight: 500;">$${d.data.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div style="display: flex; justify-content: space-between; gap: 24px;">
            <span style="opacity: 0.7;">Percentage</span>
            <span style="font-weight: 500;">${d.data.percentage.toFixed(1)}%</span>
          </div>
          ${hasDrilldown ? `<div style="margin-top: 8px; opacity: 0.55; font-size: 11px;">Click to explore subcategories →</div>` : ''}
        `)
        .style("left", (event.pageX + 15) + "px")
        .style("top", (event.pageY - 15) + "px");
      })
      .on("mousemove", function(event) {
        d3.select(".d3-pie-tooltip")
          .style("left", (event.pageX + 15) + "px")
          .style("top", (event.pageY - 15) + "px");
      })
      .on("mouseout", function() {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("d", arcGenerator)
          .style("opacity", 0.9);
        
        d3.selectAll(".d3-pie-tooltip").remove();
      })
      .on("click", function(_event, d: any) {
        d3.selectAll(".d3-pie-tooltip").remove();
        drillInRef.current(d.data);
      });

    // Add labels with leader lines for slices > 2%
    const labels = slices.filter(d => d.data.percentage > 2);
    
    // Polyline (leader line)
    labels.append("polyline")
      .attr("stroke", isDarkMode ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.2)")
      .attr("stroke-width", 1)
      .attr("fill", "none")
      .attr("points", function(d: any) {
        const pos = labelArc.centroid(d);
        const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
        const x = Math.cos(midAngle - Math.PI / 2) * labelRadius;
        const y = Math.sin(midAngle - Math.PI / 2) * labelRadius;
        const points = [pos, [x * 0.95, y * 0.95], [x, y]];
        return points.map(p => p.join(',')).join(' ');
      });

    // Text labels
    labels.append("text")
      .attr("transform", function(d: any) {
        const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
        const x = Math.cos(midAngle - Math.PI / 2) * labelRadius;
        const y = Math.sin(midAngle - Math.PI / 2) * labelRadius;
        return `translate(${x}, ${y})`;
      })
      .attr("dy", "0.35em")
      .attr("text-anchor", function(d: any) {
        const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
        return midAngle < Math.PI ? "start" : "end";
      })
      .attr("font-family", "'Inter', -apple-system, BlinkMacSystemFont, sans-serif")
      .attr("font-size", "12px")
      .attr("fill", isDarkMode ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.8)")
      .style("pointer-events", "none")
      .each(function(d: any) {
        const text = d3.select(this);
        const name = d.data.categoryName.length > 15 
          ? d.data.categoryName.substring(0, 13) + '…' 
          : d.data.categoryName;
        
        text.append("tspan")
          .attr("font-weight", "500")
          .text(name);
        
        text.append("tspan")
          .attr("x", 0)
          .attr("dy", "1.1em")
          .attr("opacity", "0.7")
          .attr("font-size", "11px")
          .text(`${d.data.percentage.toFixed(1)}%`);
      });

    // Center label & total
    const totalAmount = currentData.reduce((sum, d) => sum + d.amount, 0);
    const centerLabelText = currentLabel.length > 14
      ? currentLabel.substring(0, 12) + '…'
      : currentLabel;

    chartG.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "-0.4em")
      .attr("font-family", "'Inter', -apple-system, BlinkMacSystemFont, sans-serif")
      .attr("font-size", "16px")
      .attr("fill", isDarkMode ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)")
      .text(centerLabelText);

    chartG.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "1.2em")
      .attr("font-family", "'Inter', -apple-system, BlinkMacSystemFont, sans-serif")
      .attr("font-size", "28px")
      .attr("font-weight", "600")
      .attr("fill", isDarkMode ? "#fff" : "#333")
      .text(`$${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`);

  }, [currentData, currentLabel, width, height, isDarkMode]);

  // Animate wrapper: exit fades out, enter is instant-reset to 0, idle fades in
  const wrapperStyle: React.CSSProperties = animPhase === 'exit'
    ? { opacity: 0, transform: 'scale(0.94)', transition: 'opacity 220ms ease, transform 220ms ease' }
    : animPhase === 'enter'
    ? { opacity: 0, transform: 'scale(1.03)', transition: 'none' }
    : { opacity: 1, transform: 'scale(1)', transition: 'opacity 300ms ease, transform 300ms ease' };

  if (!data || !data.length) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: height,
        color: isDarkMode ? 'rgba(255,255,255,0.5)' : '#666',
        fontSize: '14px'
      }}>
        No spending data found for the selected date range.
      </div>
    );
  }

  const breadcrumbs = [...drillStack.map(l => l.label), currentLabel];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      {/* Breadcrumb nav — only shown when drilled in */}
      {drillStack.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 16,
          alignSelf: 'flex-start',
          paddingLeft: 8,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          fontSize: '13px',
          color: isDarkMode ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.55)',
        }}>
          <button
            onClick={drillOut}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              padding: '4px 10px',
              color: isDarkMode ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.75)',
              fontSize: '13px',
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              transition: 'background 150ms ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = isDarkMode ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.11)')}
            onMouseLeave={e => (e.currentTarget.style.background = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')}
          >
            ← Back
          </button>
          {breadcrumbs.map((label, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span style={{ opacity: 0.35 }}>/</span>}
              <span style={{
                opacity: i < breadcrumbs.length - 1 ? 0.5 : 1,
                fontWeight: i === breadcrumbs.length - 1 ? 500 : 400,
              }}>
                {label}
              </span>
            </React.Fragment>
          ))}
        </div>
      )}
      <div style={wrapperStyle}>
        <svg ref={svgRef}></svg>
      </div>
    </div>
  );
};

export default D3PieChart;
