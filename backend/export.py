"""
QRCAD v2.0 - backend/export.py
Export search results to CSV or PDF format.
Handles both single-query and batch-query exports.
"""

import csv
import io
from datetime import datetime
from typing import List, Dict, Any

try:
    from reportlab.lib.pagesizes import letter, A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.enums import TA_CENTER, TA_LEFT
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False


def generate_csv(
    query_filename: str,
    results: List,
    timestamp: str,
    batch: bool = False,
    batch_data: List[Dict] = None
) -> str:
    """
    Generate CSV content from search results with metadata.
    
    Args:
        query_filename: Name of the query STL file
        results: List of result dicts with filename, similarity, metadata
        timestamp: ISO timestamp string
        batch: If True, generate batch report
        batch_data: List of {query_filename, results, timestamp} dicts for batch mode
        
    Returns:
        CSV string content
    """
    output = io.StringIO()
    writer = csv.writer(output)
    
    if batch and batch_data:
        # Batch mode: multiple queries with metadata
        writer.writerow([
            'Query File', 'Rank', 'Matched File', 'Similarity Score',
            'File Size', 'Vertices', 'Faces', 'Bounding Box', 
            'Surface Area', 'Volume', 'Watertight', 'Date Modified', 'Format', 'Timestamp'
        ])
        
        for query_data in batch_data:
            q_file = query_data.get('query_filename', 'Unknown')
            q_results = query_data.get('results', [])
            q_timestamp = query_data.get('timestamp', timestamp)
            
            for rank, result in enumerate(q_results, start=1):
                # Handle both old format (list) and new format (dict)
                if isinstance(result, dict):
                    filename = result.get('filename', 'N/A')
                    similarity = f"{result.get('similarity', 0) * 100:.2f}%"
                    metadata = result.get('metadata', {})
                else:
                    # Old format: [filename, similarity]
                    filename = result[0] if len(result) > 0 else 'N/A'
                    similarity = f"{result[1] * 100:.2f}%" if len(result) > 1 else '0.00%'
                    metadata = {}
                
                # Extract metadata fields
                file_size = metadata.get('file_size_bytes', 'N/A')
                vertices = metadata.get('vertex_count', 'N/A')
                faces = metadata.get('face_count', 'N/A')
                bbox = metadata.get('bounding_box', {})
                bbox_str = f"{bbox.get('x', 0):.2f}x{bbox.get('y', 0):.2f}x{bbox.get('z', 0):.2f}" if bbox else 'N/A'
                surface_area = f"{metadata.get('surface_area', 0):.2f}" if metadata.get('surface_area') is not None else 'N/A'
                volume = f"{metadata.get('volume', 0):.2f}" if metadata.get('volume') is not None else 'N/A'
                watertight = 'Yes' if metadata.get('watertight', False) else 'No'
                date_modified = metadata.get('date_modified', 'N/A')
                file_format = metadata.get('file_format', 'N/A')
                
                writer.writerow([
                    q_file, rank, filename, similarity,
                    file_size, vertices, faces, bbox_str,
                    surface_area, volume, watertight, date_modified, file_format, q_timestamp
                ])
            
            # Empty row separator between queries
            if q_file != batch_data[-1].get('query_filename'):
                writer.writerow([])
    else:
        # Single query mode with metadata
        writer.writerow([
            'Rank', 'Matched File', 'Similarity Score', 'Query File',
            'File Size', 'Vertices', 'Faces', 'Bounding Box',
            'Surface Area', 'Volume', 'Watertight', 'Date Modified', 'Format', 'Timestamp'
        ])
        
        for rank, result in enumerate(results, start=1):
            # Handle both old format (list) and new format (dict)
            if isinstance(result, dict):
                filename = result.get('filename', 'N/A')
                similarity = f"{result.get('similarity', 0) * 100:.2f}%"
                metadata = result.get('metadata', {})
            else:
                # Old format: [filename, similarity]
                filename = result[0] if len(result) > 0 else 'N/A'
                similarity = f"{result[1] * 100:.2f}%" if len(result) > 1 else '0.00%'
                metadata = {}
            
            # Extract metadata fields
            file_size = metadata.get('file_size_bytes', 'N/A')
            vertices = metadata.get('vertex_count', 'N/A')
            faces = metadata.get('face_count', 'N/A')
            bbox = metadata.get('bounding_box', {})
            bbox_str = f"{bbox.get('x', 0):.2f}x{bbox.get('y', 0):.2f}x{bbox.get('z', 0):.2f}" if bbox else 'N/A'
            surface_area = f"{metadata.get('surface_area', 0):.2f}" if metadata.get('surface_area') is not None else 'N/A'
            volume = f"{metadata.get('volume', 0):.2f}" if metadata.get('volume') is not None else 'N/A'
            watertight = 'Yes' if metadata.get('watertight', False) else 'No'
            date_modified = metadata.get('date_modified', 'N/A')
            file_format = metadata.get('file_format', 'N/A')
            
            writer.writerow([
                rank, filename, similarity, query_filename,
                file_size, vertices, faces, bbox_str,
                surface_area, volume, watertight, date_modified, file_format, timestamp
            ])
    
    return output.getvalue()


def generate_pdf(
    query_filename: str,
    results: List,
    timestamp: str,
    batch: bool = False,
    batch_data: List[Dict] = None
) -> bytes:
    """
    Generate PDF report from search results with metadata.
    
    Args:
        query_filename: Name of the query STL file
        results: List of result dicts with filename, similarity, metadata
        timestamp: ISO timestamp string
        batch: If True, generate batch report
        batch_data: List of {query_filename, results, timestamp} dicts for batch mode
        
    Returns:
        PDF bytes content
        
    Raises:
        RuntimeError: If reportlab is not available
    """
    if not REPORTLAB_AVAILABLE:
        raise RuntimeError(
            "PDF export requires reportlab. Install with: pip install reportlab"
        )
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=0.5*inch,
        leftMargin=0.5*inch,
        topMargin=0.75*inch,
        bottomMargin=0.5*inch
    )
    
    # Build document elements
    story = []
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.HexColor('#00d4ff'),
        spaceAfter=6,
        alignment=TA_CENTER
    )
    
    subtitle_style = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#4a6070'),
        spaceAfter=12,
        alignment=TA_CENTER
    )
    
    section_style = ParagraphStyle(
        'SectionHeader',
        parent=styles['Heading2'],
        fontSize=12,
        textColor=colors.HexColor('#00ff9d'),
        spaceAfter=8,
        spaceBefore=16
    )
    
    # Header
    story.append(Paragraph("[QRCAD v2.0] 3D Shape Retrieval Report", title_style))
    story.append(Paragraph(f"Generated: {timestamp}", subtitle_style))
    story.append(Spacer(1, 0.2*inch))
    
    if batch and batch_data:
        # Batch mode: multiple queries
        story.append(Paragraph(f"Batch Report - {len(batch_data)} Queries", section_style))
        
        for idx, query_data in enumerate(batch_data, start=1):
            q_file = query_data.get('query_filename', 'Unknown')
            q_results = query_data.get('results', [])
            
            story.append(Paragraph(f"Query {idx}: {q_file}", section_style))
            
            # Build table data with metadata
            table_data = [['Rank', 'Matched File', 'Similarity', 'Vertices', 'Faces', 'Volume']]
            for rank, result in enumerate(q_results, start=1):
                if isinstance(result, dict):
                    filename = result.get('filename', 'N/A')
                    similarity = f"{result.get('similarity', 0) * 100:.2f}%"
                    metadata = result.get('metadata', {})
                else:
                    filename = result[0] if len(result) > 0 else 'N/A'
                    similarity = f"{result[1] * 100:.2f}%" if len(result) > 1 else '0.00%'
                    metadata = {}
                
                vertices = metadata.get('vertex_count', 'N/A')
                faces = metadata.get('face_count', 'N/A')
                volume = f"{metadata.get('volume', 0):.2f}" if metadata.get('volume') is not None else 'N/A'
                
                table_data.append([str(rank), filename, similarity, str(vertices), str(faces), volume])
            
            # Create table
            table = Table(table_data, colWidths=[0.5*inch, 2.5*inch, 0.9*inch, 0.9*inch, 0.9*inch, 0.9*inch])
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0d1318')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#00d4ff')),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('ALIGN', (2, 0), (2, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 9),
                ('FONTSIZE', (0, 1), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                ('TOPPADDING', (0, 1), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 1), (-1, -1), 4),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#1e3040')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8f9fa')])
            ]))
            
            story.append(table)
            story.append(Spacer(1, 0.3*inch))
    else:
        # Single query mode with metadata
        story.append(Paragraph(f"Query File: {query_filename}", section_style))
        story.append(Spacer(1, 0.1*inch))
        
        # Build table data with metadata
        table_data = [['Rank', 'Matched File', 'Similarity', 'Vertices', 'Faces', 'Volume']]
        for rank, result in enumerate(results, start=1):
            if isinstance(result, dict):
                filename = result.get('filename', 'N/A')
                similarity = f"{result.get('similarity', 0) * 100:.2f}%"
                metadata = result.get('metadata', {})
            else:
                filename = result[0] if len(result) > 0 else 'N/A'
                similarity = f"{result[1] * 100:.2f}%" if len(result) > 1 else '0.00%'
                metadata = {}
            
            vertices = metadata.get('vertex_count', 'N/A')
            faces = metadata.get('face_count', 'N/A')
            volume = f"{metadata.get('volume', 0):.2f}" if metadata.get('volume') is not None else 'N/A'
            
            table_data.append([str(rank), filename, similarity, str(vertices), str(faces), volume])
        
        # Create table with styling
        table = Table(table_data, colWidths=[0.5*inch, 2.5*inch, 0.9*inch, 0.9*inch, 0.9*inch, 0.9*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0d1318')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#00d4ff')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (2, 0), (2, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
            ('TOPPADDING', (0, 1), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 4),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#1e3040')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8f9fa')])
        ]))
        
        story.append(table)
    
    # Footer
    story.append(Spacer(1, 0.3*inch))
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.HexColor('#4a6070'),
        alignment=TA_CENTER
    )
    story.append(Paragraph("QRCAD v2.0 - PCA-Based 3D Shape Retrieval System with Metadata", footer_style))
    
    # Build PDF
    doc.build(story)
    
    return buffer.getvalue()


def validate_export_request(data: Dict[str, Any]) -> tuple[bool, str]:
    """
    Validate export request payload.
    
    Returns:
        (is_valid, error_message)
    """
    if not data:
        return False, "Empty request body"
    
    export_format = data.get('format', '').lower()
    if export_format not in ['csv', 'pdf']:
        return False, "Invalid format. Must be 'csv' or 'pdf'"
    
    batch = data.get('batch', False)
    
    if batch:
        batch_data = data.get('batch_data', [])
        if not batch_data or not isinstance(batch_data, list):
            return False, "batch_data must be a non-empty array when batch=true"
        
        for item in batch_data:
            if not isinstance(item, dict):
                return False, "Each item in batch_data must be an object"
            if 'query_filename' not in item or 'results' not in item:
                return False, "Each batch item must have query_filename and results"
    else:
        if 'query_filename' not in data:
            return False, "query_filename is required"
        
        if 'results' not in data:
            return False, "results array is required"
        
        results = data.get('results', [])
        if not isinstance(results, list):
            return False, "results must be an array"
    
    return True, ""
