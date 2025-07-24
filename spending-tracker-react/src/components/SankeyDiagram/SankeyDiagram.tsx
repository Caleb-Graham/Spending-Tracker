import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3-selection';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';
import { scaleOrdinal } from 'd3-scale';
import { schemeCategory10 } from 'd3-scale-chromatic';

interface SankeyData {
  nodes: { id: string; name: string; category?: string }[];
  links: { source: string; target: string; value: number }[];
}

interface SankeyDiagramProps {
  data: SankeyData;
  width?: number;
  height?: number;
}

const SankeyDiagram: React.FC<SankeyDiagramProps> = ({ 
  data, 
  width,
  height
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });

  // Update dimensions based on container size
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const containerWidth = containerRect.width || containerRef.current.offsetWidth;
        const containerHeight = Math.max(500, window.innerHeight * 0.6); // At least 500px, max 60% of viewport
        
        // Calculate responsive dimensions with proper bounds
        const responsiveWidth = Math.max(600, Math.min(containerWidth - 40, 1400)); // Min 600px, max 1400px
        const responsiveHeight = Math.max(400, Math.min(containerHeight, 800)); // Min 400px, max 800px
        
        setDimensions({
          width: width || responsiveWidth,
          height: height || responsiveHeight
        });
      }
    };

    // Initial update
    updateDimensions();
    
    // Add resize observer for more accurate container size detection
    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    // Also listen to window resize as fallback
    window.addEventListener('resize', updateDimensions);
    
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, [width, height]);

  useEffect(() => {
    if (!data || !data.nodes.length || !data.links.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous render

    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    const innerWidth = dimensions.width - margin.left - margin.right;
    const innerHeight = dimensions.height - margin.top - margin.bottom;

    // Ensure minimum dimensions for readability
    if (innerWidth < 300 || innerHeight < 200) return;

    // Create the sankey generator
    const sankeyGenerator = sankey()
      .nodeWidth(Math.max(15, Math.min(25, innerWidth * 0.02))) // Responsive node width
      .nodePadding(Math.max(5, Math.min(12, innerHeight * 0.015))) // Responsive padding
      .extent([[1, 1], [innerWidth - 1, innerHeight - 1]]);

    // Transform data to the format D3 sankey expects
    const sankeyData = {
      nodes: data.nodes.map((d, i) => ({ ...d, index: i })),
      links: data.links.map(d => ({
        source: data.nodes.findIndex(n => n.id === d.source),
        target: data.nodes.findIndex(n => n.id === d.target),
        value: d.value
      }))
    };

    // Generate the sankey diagram
    const graph = sankeyGenerator(sankeyData as any);
    const { nodes, links } = graph;

    // Color scale with specific colors for different node types
    const color = scaleOrdinal(schemeCategory10);
    const getNodeColor = (category: string) => {
      switch (category) {
        case 'income':
          return '#4CAF50'; // Green for income
        case 'intermediate':
          return '#2196F3'; // Blue for Available Money
        case 'expense-parent':
          return '#FF9800'; // Orange for parent expense categories
        case 'expense-child':
          return '#F44336'; // Red for individual expense categories
        default:
          return color(category);
      }
    };

    const g = svg
      .attr("width", dimensions.width)
      .attr("height", dimensions.height)
      .attr("viewBox", `0 0 ${dimensions.width} ${dimensions.height}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Add links
    g.append("g")
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("d", sankeyLinkHorizontal())
      .attr("stroke", "#aaa")
      .attr("stroke-opacity", 0.5)
      .attr("stroke-width", (d: any) => Math.max(1, d.width))
      .attr("fill", "none")
      .on("mouseover", function(event, d: any) {
        d3.select(this).attr("stroke-opacity", 0.8);
        
        // Create tooltip
        const tooltip = d3.select("body").append("div")
          .attr("class", "sankey-tooltip")
          .style("position", "absolute")
          .style("background", "rgba(0, 0, 0, 0.8)")
          .style("color", "white")
          .style("padding", "8px")
          .style("border-radius", "4px")
          .style("font-size", "12px")
          .style("pointer-events", "none")
          .style("z-index", 1000);

        tooltip.html(`
          <div><strong>${d.source.name}</strong> → <strong>${d.target.name}</strong></div>
          <div>$${d.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        `)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 10) + "px");
      })
      .on("mouseout", function() {
        d3.select(this).attr("stroke-opacity", 0.5);
        d3.selectAll(".sankey-tooltip").remove();
      });

    // Add nodes
    const node = g.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g");

    node.append("rect")
      .attr("x", (d: any) => d.x0)
      .attr("y", (d: any) => d.y0)
      .attr("height", (d: any) => d.y1 - d.y0)
      .attr("width", (d: any) => d.x1 - d.x0)
            .attr("fill", (d: any) => getNodeColor(d.category || d.name))
      .attr("stroke", "#000")
      .attr("stroke-width", 0.5)
      .on("mouseover", function(event, d: any) {
        // Create tooltip
        const tooltip = d3.select("body").append("div")
          .attr("class", "sankey-tooltip")
          .style("position", "absolute")
          .style("background", "rgba(0, 0, 0, 0.8)")
          .style("color", "white")
          .style("padding", "8px")
          .style("border-radius", "4px")
          .style("font-size", "12px")
          .style("pointer-events", "none")
          .style("z-index", 1000);

        // For the "Available Money" node, show the sum of incoming links (actual income)
        // instead of the D3 calculated value which might be balanced incorrectly
        let displayValue = d.value || 0;
        if (d.name === 'Available Money') {
          const incomingLinks = data.links.filter(link => link.target === d.id);
          if (incomingLinks.length > 0) {
            displayValue = incomingLinks.reduce((sum, link) => sum + link.value, 0);
          }
        }

        tooltip.html(`
          <div><strong>${d.name}</strong></div>
          <div>Total: $${displayValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        `)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 10) + "px");
      })
      .on("mouseout", function() {
        d3.selectAll(".sankey-tooltip").remove();
      });

    // Add node labels
    node.append("text")
      .attr("x", (d: any) => d.x0 < innerWidth / 2 ? d.x1 + 6 : d.x0 - 6)
      .attr("y", (d: any) => (d.y1 + d.y0) / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", (d: any) => d.x0 < innerWidth / 2 ? "start" : "end")
      .attr("font-family", "sans-serif")
      .attr("font-size", `${Math.max(9, Math.min(12, innerWidth * 0.01))}px`) // Responsive font size
      .attr("fill", "#333")
      .text((d: any) => {
        // Show shorter names for better readability based on available space
        const name = d.name;
        const maxLength = innerWidth < 800 ? 15 : 20;
        if (name.length > maxLength) {
          return name.substring(0, maxLength - 3) + '...';
        }
        return name;
      })
      .append("title")
      .text((d: any) => d.name); // Full name on hover

  }, [data, dimensions]); // Updated dependency to use dimensions instead of width/height

  return (
    <div 
      ref={containerRef}
      style={{ 
        width: '100%', 
        height: '100%',
        minHeight: '500px',
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        overflow: 'hidden'
      }}
    >
      <svg 
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{ maxWidth: '100%', height: 'auto' }}
      ></svg>
    </div>
  );
};

export default SankeyDiagram;
