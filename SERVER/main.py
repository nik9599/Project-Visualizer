from flask import Flask
from Router.route import main
from flask_cors import CORS

app = Flask(__name__)

CORS(app)

# Register routes
app.register_blueprint(main)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)