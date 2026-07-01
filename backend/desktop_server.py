import os

import uvicorn
from app.main import app


def main():
    os.environ.setdefault("PERSONAL_LIFE_APP_DESKTOP", "1")

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=int(os.getenv("PERSONAL_LIFE_APP_PORT", "8000")),
        reload=False,
    )


if __name__ == "__main__":
    main()
