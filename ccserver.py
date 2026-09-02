from pydantic import BaseModel
from fastapi import FastAPI,Request,Response,Cookie,WebSocket
from fastapi.responses import FileResponse,RedirectResponse
from typing import Annotated
import pickle
import hashlib
import asyncio
import copy


sessionStorage={}

try: 
    db=pickle.load(open("DB.dsk","rb"))
except Exception as e:
    db={}
    db["users"]={}
    db["servers"]={}
    db["servers"]["servernamelist"]=[]
    db["servers"]["serveriplist"]=[]
    db["servers"]["serverportlist"]=[]
    db["admins"]={}
    db["admins"]["root"]={"password":"root",
                          "nonce":0}

    pickle.dump(db,open("DB.dsk","wb"))

def verifynonce(email,field,value,role="users"):
    htoken=hashlib.sha256((db[role][email][field]+str(db[role][email]["nonce"])).encode("utf-8")).hexdigest();
    if value==htoken:
        if role=="users":
            if db[role][email]["blocked"]==0:
                return True;
            else:
                return False;
        else:
            return True;
    else:
        return False;

def savetodisk():
    pickle.dump(db,open("DB.dsk","wb"))

def adduser(email,password,recharge):
    db["users"][email]={}
    db["users"][email]={"password":password,
                        "recharge":recharge,
                        "device_id":"default",
                        "nonce":0,
                        "blocked":0,
                        "bytesusedsofar":0}
    savetodisk();

send=0;
receive=0
smsg={}
rmsg=[]
routingservers=0

server=FastAPI()

@server.websocket("/ws")
async def cctorouting(websocket:WebSocket):
    global send,receive,smsg,rmsg,routingservers
    await websocket.accept()
    routingservers+=1
    done=0;
    while True:
        await asyncio.sleep(1)
        if send==0 and receive==0:
            done=0
        if send>0 and done==0:
            await websocket.send_json(smsg)
            send-=1
            done=1
            if send==0:
                smsg={}
        if receive>0 and done==0:
            try: 
                rmsg.append(await asyncio.wait_for(websocket.receive_json(),timeout=10))
            except Exception as e:
                pass
            receive-=1
            done=1
            if receive==0:
                rmsg=[]


def sendToWebsocket(msg):
    global smsg,send,routingservers
    smsg=msg
    send=routingservers
        
@server.get("/adminPanel/register/{email}/{passwd}/{servername}/{serverkey}")
async def registerServer(email,passwd,servername,serverkey):
    if verifynonce(email,"password",passwd,role="admins"):
        db["servers"][servername]={}
        db["servers"][servername]["serverkey"]=serverkey
        savetodisk()
        return {"status":"success"}
    else:
        return {"status":"error",
                "message":"Auth Error"}



@server.get("/adminPanel/removeServer/{email}/{passwd}/{servername}")
async def rmServer(email,passwd,servername):
    if verifynonce(email,"password",passwd,role="admins"):
        try:    
            del db["servers"][servername]
            ind=db["servers"]["servernamelist"].index(servername)
            del db["servers"]["serveriplist"][ind]
            del db["servers"]["serverportlist"][ind]
            del db["servers"]["servernamelist"][ind]
            savetodisk()
            return {"status":"success"}
        except Exception as e:
            return {"status":"error",
                    "message":"Server not found"}
    else:
        return {"status":"error",
                "message":"Auth Error"}




@server.get("/selfRegister/{servername}/{serverkey}/{ip}/{port}")
async def selfReg(servername,serverkey,ip,port):
    if db["servers"][servername]["serverkey"]==serverkey:
        db["servers"]["servernamelist"].append(servername)
        db["servers"]["serveriplist"].append(ip)
        db["servers"]["serverportlist"].append(port)
        
        savetodisk()
        return {"status":"success"}


@server.get("/adminPanel/blockUser/{email}/{passwd}/{userEmail}")
async def blockUser(email,passwd,userEmail):
    if verifynonce(email,"password",passwd,role="admins"):
            db["users"][userEmail]["blocked"]=1;
            sendToWebsocket({"action":"blockUser",
                             "email":email});
            savetodisk()
            return {"status":"success"}
    else:
        return {"status":"error",
                "message":"Auth Error"}

@server.get("/adminPanel/deleteUser/{email}/{passwd}/{userEmail}")
async def deleteUser(email,passwd,userEmail):
    if verifynonce(email,"password",passwd,role="admins"):
            del db["users"][userEmail]
            savetodisk()
            return {"status":"success"}
    else:
        return {"status":"error",
                "message":"Auth Error"}

@server.get("/query/{email}/{passwd}")
async def queryRoutingServers(email,passwd):
    if verifynonce(email,"password",passwd):
        return {"status":"success",
                "servernamelist":db["servers"]["servernamelist"],
                "iplist":db["servers"]["serveriplist"],
                "portlist":db["servers"]["serverportlist"]}
    else:
        return {"status":"error",
                "message":"Auth Failed"}

@server.get("/adminPanel/query/{email}/{passwd}/{userEmail}")
async def adminenquiry(email,passwd,userEmail):
    if verifynonce(email,"password",passwd,role="admins"):
        try:
            data=copy.deepcopy(db["users"][userEmail])
            del db["users"][userEmail]["password"]
            return {"status":"success",
                    "data":data}
        except Exception as e:
            return {"status":"error",
                    "message":"User Not Found"}
    else:
        return {"status":"error",
                "message":"Auth Fail"}

@server.get("/adminPanel/changeUserEmail/{email}/{passwd}/{userEmail}/{newUserEmail}")
async def changeUserEmail(email,passwd,userEmail,newUserEmail):
    if verifynonce(email,"password",passwd,role="admins"):
        try:
            data=copy.deepcopy(db["users"][userEmail])
            del db["users"][userEmail]
            db["users"][newUserEmail]=data;
            savetodisk()
            return {"status":"success"}
        except Exception as e:
            return {"status":"error",
                    "message":"User Not Found"}
    else:
        return {"status":"error",
                "message":"Auth Fail"}

@server.get("/adminPanel/listusers/{email}/{passwd}/{startingRange}/{endingRange}")
async def listusers(email,passwd,startingRange,endingRange):
    if verifynonce(email,"password",passwd,role="admins"):
        data={}
        for uemail,details in list(db["users"].items())[int(startingRange):int(endingRange)]:
            data[uemail]=copy.deepcopy(details)
            del data[uemail]["password"]
        return {"status":"success",
                "data":data}
        
    else:
        return {"status":"error",
                "message":"Auth Fail"}



@server.get("/adminPanel/nonce")
async def getnonce(request:Request):
    req=await request.json()
    db["admins"][req["UEmail"]]["nonce"]+=1
    return {"nonce":db["admins"][req["UEmail"]]["nonce"]}



    





@server.get("/reporting/dataUsage/{email}/{passwd}/{data}")
async def reporting(email,passwd,data):
    if verifynonce(email,"password",passwd):
        if data=="8799007739":
            db["users"][email]["recharge"]=0;
            db["users"][email]["bytesusedsofar"]=0;
            savetodisk()
            return "OK"
        db["users"][email]["bytesusedsofar"]+=float(data)
        savetodisk()
        if db["users"][email]["bytesusedsofar"]>(db["users"][email]["recharge"]*1000*1000*1000):
            db["users"][email]["recharge"]=0;
            db["users"][email]["bytesusedsofar"]=0;
            savetodisk()
        return "OK"

@server.get("/changedevice/{email}/{passwd}/{deviceId}")
async def changedevice(email,passwd,deviceId):
    if verifynonce(email,"password",passwd):
        db["users"][email]["device_id"]=deviceId;
        return {"status":"ok"}

@server.get("/authenticate/{email}/{passwd}/{deviceId}")
async def appauth(email,passwd,deviceId):
    if db["users"][email]["blocked"]==1:
        return {"status":"Blocked"}
    if verifynonce(email,"password",passwd):
        if db["users"][email]["device_id"]=="default":
            db["users"][email]["device_id"]=deviceId;
            return {"status":"success",
                    "data":{"email":email,
                        "quota":db["users"][email]["recharge"],
                        "bytesusedsofar":db["users"][email]["bytesusedsofar"]

                        },
                        }

        
        elif deviceId!=db["users"][email]["device_id"] and db["users"][email]["device_id"]!="default":
            return {"status":"ADR"}
        elif deviceId==db["users"][email]["device_id"]:
            return {"status":"success",
                                "data":{"email":email,
                                    "quota":db["users"][email]["recharge"],
                                    "bytesusedsofar":db["users"][email]["bytesusedsofar"]
                                    }}
    else:
        return {"status":"AuthFail"}
    

@server.get("/nonce")
async def getnonce(request:Request):
    req=await request.json()
    db["users"][req["UEmail"]]["nonce"]+=1
    return {"nonce":db["users"][req["UEmail"]]["nonce"]}



@server.get("/{path:path}")
async def root(path,cr:Annotated[str|None,Cookie()]=None):
    print(path)
    path=path
    if path=="":
        return FileResponse("index.html");
    elif path=="recharge.html":
        
        return RedirectResponse(url=f"/recharge_new.html?cr={cr}")
    try:
       open(path,"rb")
    except Exception as e:
        return FileResponse("index.html");
    return FileResponse(path);

class suuserdata(BaseModel):
    email: str
    password: str

@server.post("/auth/signup")
def signup(signup:suuserdata):
    try:
        db["users"][signup.email]["password"]
        return {"status":"error","message":"Account already exist"}
    except Exception as e:
        adduser(signup.email,signup.password,0)
        token=hashlib.sha256((db["users"][signup.email]["password"]).encode('utf-8')).hexdigest()
        return {
  "status": "success",
  "message": "Account Created ! Now login...",
  "token": token,
  "user": {
    "id": "usr_98124",
    "email": signup.email,
    "createdAt": "2026-08-26T17:15:00Z"
  }
}

@server.post("/auth/login")
def login(signup:suuserdata,response:Response):
    try:
        if((db["users"][signup.email]["password"])!=signup.password):
           
           raise Exception("Invalid Auth") 
        token=hashlib.sha256((db["users"][signup.email]["password"]).encode('utf-8')).hexdigest()
        response.set_cookie(key="cr",value=( round((( (db["users"][signup.email]["recharge"]*1000*1000*1000)-db["users"][signup.email]["bytesusedsofar"])/(1000*1000*1000) ),2)));
        return {
        "status": "success",
        "message": "Logged In",
        "token": token,
        "user": {
            "id": "usr_98124",
            "email": signup.email,
            "lastLogin": "2026-08-26T17:15:00Z"
        }
        }
    except Exception as e:
        print(e)
        return {
  "status": "error",
  "message": "Invalid email or password."
}

@server.post("/recharge/process")
async def recharge(request:Request):
    htoken=request.headers.get("Authorization").replace("Bearer ","")
    
    req=await request.json()
    token=hashlib.sha256((db["users"][req["userEmail"]]["password"]).encode('utf-8')).hexdigest()
    if htoken==token:
        db["users"][req["userEmail"]]["recharge"]+=float(req["plan"]);
        savetodisk()
        return {
  "status": "success",
  "transactionId": "TXN_7849201",
  "plan": req["plan"] + " GB",
  "amount": "$2.99",
  "timestamp": "2026-08-26T17:15:00Z",
  "message": "Recharge completed successfully for plan 1.5gb"
}
    else:
        return {"status": "error","message":"Authentication Failed"}


    

    
    

