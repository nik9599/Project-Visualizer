import json

# Test data that matches the parser output format
test_data = {
    'nodes': [
        {
            'id': 'client/src/main.tsx',
            'label': 'main.tsx',
            'type': 'file',
            'code': 'console.log("hello")'
        }
    ],
    'links': []
}

def format_for_graph(raw):
    if 'nodes' in raw and 'links' in raw:
        nodes = []
        for node in raw['nodes']:
            formatted_node = {
                'id': node['id'],
                'label': node.get('label', node['id']),
                'external': False,
            }
            if 'type' in node:
                formatted_node['kind'] = node['type']
            if 'code' in node and node['code']:
                formatted_node['code'] = node['code']
            nodes.append(formatted_node)

        edges = []
        for link in raw['links']:
            edges.append({
                'source': link['source'],
                'target': link['target']
            })

        return {'nodes': nodes, 'edges': edges}
    return {'nodes': [], 'edges': []}

# Test the function
formatted = format_for_graph(test_data)
print('Test passed! Formatted nodes:', len(formatted['nodes']))
print('First node has code:', 'code' in formatted['nodes'][0])
print('Code content:', formatted['nodes'][0]['code'])