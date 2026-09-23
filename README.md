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

#### > Server IP

Server IP address is required by clients and routing server if it doesn't have any domain name associated with, server ip can be found using:

For Windows:
```ps
ipconfig
```

the ccserver url then will be in this format: `http://<ip_address>:8338/`


#### > How to start the system
1. Start the ccserver
2. From Admin Dashboard (http://127.0.0.1:8338/adminops)
   - Navigate to server registry -> Register new server (One time only)
   - Enter Sever Name
   - Enter Server Key
3. Now configure routing server with the same server name and server key and also configure other details.
4. Start the routing server.
5. Now Client App is ready to run but before that chrome extension must be installed in the clients browser.
