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

    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
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
      .attr("fill", (_, i) => color(i.toString()))
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
          .style("z-index", 9999); // Very high z-index to appear above dialogs

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

    // Add labels for all slices
    arcs.append("text")
      .attr("transform", (d: any) => `translate(${labelArc.centroid(d)})`)
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .attr("font-family", "Arial, sans-serif")
      .attr("font-size", (d: any) => d.data.percentage > 8 ? "13px" : d.data.percentage > 3 ? "11px" : "9px")
      .attr("fill", "white")
      .attr("font-weight", "700")
      .style("text-shadow", "1px 1px 1px rgba(0,0,0,0.5)")
      .style("pointer-events", "none")
      .each(function(d: any) {
        const text = d3.select(this);
        const lines = [];
        
        // For larger slices, show category name and percentage
        if (d.data.percentage > 8) {
          lines.push(d.data.categoryName);
          lines.push(`${d.data.percentage.toFixed(1)}%`);
        } 
        // For medium slices, show abbreviated name and percentage
        else if (d.data.percentage > 3) {
          const shortName = d.data.categoryName.length > 12 
            ? d.data.categoryName.substring(0, 10) + "..." 
            : d.data.categoryName;
          lines.push(shortName);
          lines.push(`${d.data.percentage.toFixed(1)}%`);
        }
        // For small slices, just show percentage
        else if (d.data.percentage > 1.5) {
          lines.push(`${d.data.percentage.toFixed(1)}%`);
        }
        
        // Add each line as a tspan
        lines.forEach((line, i) => {
          text.append("tspan")
            .attr("x", 0)
            .attr("dy", i === 0 ? 0 : "1.2em")
            .text(line);
        });
      });

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
