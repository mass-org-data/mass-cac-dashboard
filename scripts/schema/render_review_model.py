"""Render a connector-free, editable model from read-only PostgreSQL metadata.

Usage: python scripts/schema/render_review_model.py CATALOG.json OUTPUT.drawio
Contains no database connection or data mutation path.
"""
import html
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

catalog = json.loads(Path(sys.argv[1]).read_text())
groups = [
    ('Directory and access', 'mass_core', ['donors', 'centres', 'staff_members', 'centre_staff_assignments', 'user_scope_grants', 'registration_requests']),
    ('Students and attendance', 'mass_core', ['children', 'private_child_profiles', 'enrolments', 'attendance_codes', 'cac_sessions', 'attendance_records', 'cac_delivery_records']),
    ('Learning and activities', 'mass_core', ['academic_years', 'assessment_periods', 'assessment_definitions', 'assessment_results', 'activity_events', 'activity_participation']),
    ('Morarji', 'mass_core', ['programme_cohorts', 'cohort_memberships', 'morarji_outcomes']),
    ('Officer visits', 'mass_core', ['officer_assignments', 'cluster_officer_visits', 'visit_revisions']),
    ('Import provenance and audit', None, None),
    ('Private operational controls', None, None),
]
byname = {(t['schema'], t['name']): t for t in catalog}
seen = set()
root = ET.Element('mxfile', host='app.diagrams.net', type='device', version='24.7.17')


def cell(parent, key, value, style, x, y, w, h, owner='1'):
    c = ET.SubElement(parent, 'mxCell', id=key, value=value, style=style, vertex='1', parent=owner)
    ET.SubElement(c, 'mxGeometry', x=str(x), y=str(y), width=str(w), height=str(h), **{'as': 'geometry'})
    return c


for page, (title, schema, names) in enumerate(groups):
    if schema:
        tables = [byname[(schema, n)] for n in names]
    else:
        selected = ('mass_foundation', 'mass_import') if page == 5 else ('mass_activation', 'mass_maintenance')
        tables = [t for t in catalog if t['schema'] in selected]
    diagram = ET.SubElement(root, 'diagram', name=title, id='section-' + str(page))
    graph = ET.SubElement(diagram, 'mxGraphModel', dx='1800', dy='1600', grid='1', gridSize='10', page='1', pageScale='1', pageWidth='1740', pageHeight='2400', math='0', shadow='0')
    items = ET.SubElement(graph, 'root')
    ET.SubElement(items, 'mxCell', id='0')
    ET.SubElement(items, 'mxCell', id='1', parent='0')
    schema_label = schema if schema else ('mass_foundation / mass_import' if page == 5 else 'mass_activation / mass_maintenance')
    header = f'<b>MASS CAC — {html.escape(title)}</b><br/>Schema: {schema_label} | Live catalog: 5 November 2026<br/>Table names below exclude the schema prefix. * = required. PK/FK markers describe actual keys; composite FKs must be read together. No relationship arrows.'
    cell(items, 'header', header, 'text;html=1;align=left;verticalAlign=top;fontSize=17;whiteSpace=wrap;', 30, 20, 1660, 95)
    lanes = [140, 140, 140]
    for t in tables:
        key = t['schema'] + '.' + t['name']
        seen.add((t['schema'], t['name']))
        lane = min(range(3), key=lambda i: lanes[i])
        x, y = 30 + lane * 560, lanes[lane]
        fks = sorted({fk for col in t['columns'] for fk in (col['foreign'] or [])})
        footnotes = ['Schema: ' + t['schema'] + ' | RLS: ' + ('enabled + forced' if t['rls'] and t['forced_rls'] else 'REVIEW')]
        footnotes += [f'FK{i+1}: ' + fk.replace(' ON DELETE RESTRICT', '') for i, fk in enumerate(fks)]
        foot_h = sum(28 + 16 * (len(line) // 77) for line in footnotes)
        height = 38 + 26 * len(t['columns']) + foot_h
        color = '#e6f1ee' if t['schema'] == 'mass_core' else '#e9edf6'
        cell(items, key, '<b>' + html.escape(t['name']) + '</b>', f'swimlane;html=1;startSize=38;horizontal=1;rounded=0;fillColor={color};strokeColor=#a6b7b1;fontSize=14;align=center;whiteSpace=wrap;', x, y, 530, height)
        for i, col in enumerate(t['columns']):
            tags = (['PK'] if col['primary'] else []) + [f'FK{fks.index(fk)+1}' for fk in (col['foreign'] or [])]
            left = html.escape(col['name']) + (' *' if col['required'] else '')
            right = html.escape(col['type']) + (' [' + ', '.join(tags) + ']' if tags else '')
            style = 'text;html=1;align=left;verticalAlign=middle;spacingLeft=8;fontSize=11;whiteSpace=wrap;overflow=hidden;strokeColor=#dfe7e3;fillColor=#ffffff;'
            cell(items, key + '-' + col['name'], left, style, 0, 38 + i * 26, 278, 26, key)
            cell(items, key + '-' + col['name'] + '-type', right, style, 278, 38 + i * 26, 252, 26, key)
        fy = 38 + 26 * len(t['columns'])
        for i, line in enumerate(footnotes):
            h = 28 + 16 * (len(line) // 77)
            cell(items, key + '-note-' + str(i), html.escape(line), 'text;html=1;align=left;verticalAlign=middle;spacingLeft=8;spacingRight=8;fontSize=10;whiteSpace=wrap;fillColor=#f4f7f6;', 0, fy, 530, h, key)
            fy += h
        lanes[lane] = y + height + 35
    cell(items, 'scope-note', 'Physical schema snapshot; a deployed table does not imply its write workflow is activated. Private source/audit/control/cleanup relations are not staff-facing forms or public APIs.', 'text;html=1;align=left;verticalAlign=top;fontSize=13;whiteSpace=wrap;', 30, max(lanes) + 10, 1650, 70)

if seen != set(byname):
    raise ValueError('Unmapped catalog tables: ' + repr(set(byname) - seen))
ET.indent(root)
Path(sys.argv[2]).write_bytes(ET.tostring(root, encoding='utf-8', xml_declaration=True))
print(json.dumps({'tables': len(seen), 'columns': sum(len(t['columns']) for t in catalog), 'pages': len(groups), 'edges': 0}))
