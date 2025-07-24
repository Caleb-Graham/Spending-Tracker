import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3-selection';
import 'd3-transition'; // Import for transition support
import { pie, arc } from 'd3-shape';
import { scaleOrdinal } from 'd3-scale';
import { schemeCategory10 } from 'd3-scale-chromatic';

interface PieData {
  categoryId: number;
  categoryName: string;
  amount: number;
  percentage: number;
}

interface D3PieChartProps {
  data: PieData[];
  width?: number;
  height?: number;
}

const D3PieChart: React.FC<D3PieChartProps> = ({ 
  data, 
  width = 500, 
  height = 500 
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!data || !data.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous render

    const margin = { top: 20, right: 20, bottom: 160, left: 20 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const radius = Math.min(innerWidth, innerHeight) / 2;

    // Color scale
    const color = scaleOrdinal(schemeCategory10);

    // Create the pie generator
    const pieGenerator = pie<PieData>()
      .value(d => d.amount)
      .sort(null);

    // Create the arc generator
    const arcGenerator = arc<any>()
      .innerRadius(0)
      .outerRadius(radius - 10);

    // Arc generator for labels
    const labelArc = arc<any>()
      .innerRadius(radius - 40)
      .outerRadius(radius - 40);

    const g = svg
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${width / 2},${(height - margin.bottom) / 2 + margin.top})`);

    const arcs = g.selectAll(".arc")
      .data(pieGenerator(data))
      .enter().append("g")
      .attr("class", "arc");

    // Add pie slices
    arcs.append("path")
      .attr("d", arcGenerator)
      .attr("fill", (d, i) => color(i.toString()))
      .attr("stroke", "white")
      .attr("stroke-width", 2)
      .on("mouseover", function(event, d: any) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("transform", "scale(1.05)");
        
        // Create tooltip
        const tooltip = d3.select("body").append("div")
          .attr("class", "d3-pie-tooltip")
          .style("position", "absolute")
          .style("background", "rgba(0, 0, 0, 0.8)")
          .style("color", "white")
          .style("padding", "8px")
          .style("border-radius", "4px")
          .style("font-size", "12px")
          .style("pointer-events", "none")
          .style("z-index", 1000);

        tooltip.html(`
          <div><strong>${d.data.categoryName}</strong></div>
          <div>$${d.data.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div>${d.data.percentage.toFixed(1)}%</div>
        `)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 10) + "px");
      })
      .on("mouseout", function() {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("transform", "scale(1)");
        
        d3.selectAll(".d3-pie-tooltip").remove();
      });

    // Add labels (only for slices > 5%)
    arcs.append("text")
      .attr("transform", (d: any) => `translate(${labelArc.centroid(d)})`)
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .attr("font-family", "sans-serif")
      .attr("font-size", "11px")
      .attr("fill", "white")
      .attr("font-weight", "bold")
      .style("text-shadow", "1px 1px 2px rgba(0,0,0,0.7)")
      .text((d: any) => d.data.percentage > 5 ? `${d.data.percentage.toFixed(1)}%` : "");

    // Create legend
    const legend = svg.append("g")
      .attr("class", "legend")
      .attr("transform", `translate(20, ${height - margin.bottom + 30})`);

    const legendItems = legend.selectAll(".legend-item")
      .data(data)
      .enter().append("g")
      .attr("class", "legend-item")
      .attr("transform", (d, i) => {
        const itemsPerRow = Math.floor((innerWidth + 40) / 160); // Adjust for wider spacing
        const row = Math.floor(i / itemsPerRow);
        const col = i % itemsPerRow;
        return `translate(${col * 160}, ${row * 24})`; // Increase vertical spacing even more
      });

    legendItems.append("rect")
      .attr("width", 12)
      .attr("height", 12)
      .attr("fill", (d, i) => color(i.toString()));

    legendItems.append("text")
      .attr("x", 18)
      .attr("y", 9)
      .attr("dy", "0.35em")
      .attr("font-family", "sans-serif")
      .attr("font-size", "12px")
      .attr("fill", "#333")
      .text((d: any) => `${d.categoryName} (${d.percentage.toFixed(1)}%)`);

  }, [data, width, height]);

  if (!data || !data.length) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: height,
        color: '#666',
        fontSize: '14px'
      }}>
        No spending data found for the selected date range.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <svg ref={svgRef}></svg>
    </div>
  );
};

export default D3PieChart;
