# ccserver.py

This is the command-and-control server for CloudVPN.

### Install Requirements

```ps
python3 -m pip install -r requirements.txt
```
### Running the server

```ps
python3 -m uvicorn ccserver:server --reload --host 0.0.0.0 --port 8338
```
