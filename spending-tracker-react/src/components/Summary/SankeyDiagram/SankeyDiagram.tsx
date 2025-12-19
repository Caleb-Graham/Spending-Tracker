import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3-selection';
import { zoom, zoomIdentity } from 'd3-zoom';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';
import { useTheme } from '@mui/material/styles';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { ZoomIn, ZoomOut, CenterFocusStrong } from '@mui/icons-material';

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
  const [currentZoom, setCurrentZoom] = useState(1);
  const zoomBehaviorRef = useRef<any>(null);
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

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

    // Color function for different node types
    const getNodeColor = (category: string) => {
      switch (category) {
        case 'income':
          return '#4CAF50'; // Green for income
        case 'intermediate':
          return '#2196F3'; // Blue for Available Money
        case 'expense-parent':
        case 'expense-child':
          return '#FF9800'; // Orange for expense categories
        default:
          return '#9E9E9E'; // Gray fallback
      }
    };

    // Theme-aware colors
    const linkColor = isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.2)';
    const linkHoverOpacity = isDarkMode ? 0.6 : 0.5;
    const textColor = isDarkMode ? '#e0e0e0' : '#333';
    const nodeStrokeColor = isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)';

    // Set up zoom behavior
    const zoomBehavior = zoom()
      .scaleExtent([0.3, 4]) // Allow zoom from 30% to 400%
      .on('zoom', (event: any) => {
        g.attr('transform', event.transform);
        setCurrentZoom(event.transform.k);
      });
    
    zoomBehaviorRef.current = zoomBehavior;
    
    svg
      .attr("width", dimensions.width)
      .attr("height", dimensions.height)
      .attr("viewBox", `0 0 ${dimensions.width} ${dimensions.height}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("cursor", "grab")
      .call(zoomBehavior as any)
      .on("dblclick.zoom", null); // Disable double-click zoom
    
    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Add links
    g.append("g")
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("d", sankeyLinkHorizontal())
      .attr("stroke", linkColor)
      .attr("stroke-opacity", isDarkMode ? 0.5 : 0.4)
      .attr("stroke-width", (d: any) => Math.max(1, d.width))
      .attr("fill", "none")
      .on("mouseover", function(event, d: any) {
        d3.select(this).attr("stroke-opacity", linkHoverOpacity);
        
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

       
        // Calculate total income for percentage calculation
        const totalIncome = data.links
          .filter(link => {
            const sourceNode = data.nodes.find(n => n.id === link.source);
            return sourceNode?.category === 'income';
          })
          .reduce((sum, link) => sum + link.value, 0);

        const percentage = totalIncome > 0 ? (d.value / totalIncome * 100) : 0;

        tooltip.html(`
          <div><strong>${d.source.name}</strong> → <strong>${d.target.name}</strong></div>
          <div>Amount: $${d.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div style="color: #90EE90; font-weight: bold;">Percentage: ${percentage.toFixed(1)}%</div>
          <div style="font-size: 11px; opacity: 0.8;">of $${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total income</div>
        `)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 10) + "px");
      })
      .on("mouseout", function() {
        d3.select(this).attr("stroke-opacity", isDarkMode ? 0.5 : 0.4);
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
      .attr("stroke", nodeStrokeColor)
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

         // Calculate total income for percentage calculation
        const totalIncome = data.links
          .filter(link => {
            const sourceNode = data.nodes.find(n => n.id === link.source);
            return sourceNode?.category === 'income';
          })
          .reduce((sum, link) => sum + link.value, 0);

        const percentage = totalIncome > 0 ? (displayValue / totalIncome * 100) : 0;

        tooltip.html(`
          <div><strong>${d.name}</strong></div>
          <div>Amount: $${displayValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div style="color: #90EE90; font-weight: bold;">Percentage: ${percentage.toFixed(1)}%</div>
          <div style="font-size: 11px; opacity: 0.8;">of $${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total income</div>
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
      .attr("fill", textColor)
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

  }, [data, dimensions, isDarkMode]); // Re-render on theme change

  // Zoom control handlers
  const handleZoomIn = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      const svg = d3.select(svgRef.current);
      svg.transition().duration(300).call(
        zoomBehaviorRef.current.scaleBy as any, 
        1.3
      );
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      const svg = d3.select(svgRef.current);
      svg.transition().duration(300).call(
        zoomBehaviorRef.current.scaleBy as any, 
        0.7
      );
    }
  };

  const handleResetZoom = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      const svg = d3.select(svgRef.current);
      svg.transition().duration(300).call(
        zoomBehaviorRef.current.transform as any, 
        zoomIdentity
      );
    }
  };

  return (
    <Box 
      ref={containerRef}
      sx={{ 
        width: '100%', 
        height: '100%',
        minHeight: '700px',
        display: 'flex', 
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Zoom Controls */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1,
          backgroundColor: isDarkMode ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.95)',
          borderRadius: 1.5,
          padding: '8px 12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Tooltip title="Zoom Out" placement="right">
            <IconButton size="small" onClick={handleZoomOut}>
              <ZoomOut fontSize="small" />
            </IconButton>
          </Tooltip>
          <Typography variant="caption" sx={{ minWidth: 50, textAlign: 'center', fontWeight: 500 }}>
            {Math.round(currentZoom * 100)}%
          </Typography>
          <Tooltip title="Zoom In" placement="right">
            <IconButton size="small" onClick={handleZoomIn}>
              <ZoomIn fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Tooltip title="Reset View" placement="right">
          <IconButton size="small" onClick={handleResetZoom}>
            <CenterFocusStrong fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      
      {/* Help text */}
      <Typography 
        variant="caption" 
        sx={{ 
          position: 'absolute', 
          bottom: 16, 
          right: 16, 
          opacity: 0.5,
          backgroundColor: isDarkMode ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.8)',
          padding: '4px 12px',
          borderRadius: 1,
          fontSize: '0.75rem'
        }}
      >
        Scroll to zoom • Drag to pan
      </Typography>
      
      <svg 
        ref={svgRef}
        style={{ 
          width: '100%', 
          height: '100%',
          flex: 1,
          display: 'block'
        }}
      ></svg>
    </Box>
  );
};

export default SankeyDiagram;
