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

### Extra Note

Server IP address is required by clients and routing server if it doesn't have any domain name associated with, server ip can be found using:

For Windows:
```ps
ipconfig
```

the server url then will be in this format: `http://<ip_address>:8338/`
