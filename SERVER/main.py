from flask import Flask
from flasgger import Swagger
from Router.route import main
from flask_cors import CORS

app = Flask(__name__)

CORS(app)

# Register routes before Swagger so /apispec.json includes blueprint endpoints
app.register_blueprint(main)

# Swagger / docs config — available at /docs
swagger_config = {
    "headers": [],
    "specs": [
        {
            "endpoint": "apispec",
            "route": "/apispec.json",
            "rule_filter": lambda rule: True,
            "model_filter": lambda tag: True,
        }
    ],
    "static_url_path": "/flasgger_static",
    "swagger_ui": True,
    "specs_route": "/docs",
}

swagger_template = {
    "info": {
        "title": "ProjectVisulizar API",
        "description": "API for the JS Call Graph Visualizer",
        "version": "1.0.0",
    }
}

Swagger(app, config=swagger_config, template=swagger_template)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)