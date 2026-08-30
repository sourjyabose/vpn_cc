from pydantic import BaseModel
from fastapi import FastAPI,Request,Response,Cookie
from fastapi.responses import FileResponse,RedirectResponse
from typing import Annotated
import pickle
import hashlib

try: 
    db=pickle.load(open("DB.dsk","rb"))
except Exception as e:
    db={}
    db["users"]={}
    pickle.dump(db,open("DB.dsk","wb"))

def verifynonce(email,field,value):
    htoken=hashlib.sha256((db["users"][email][field]+str(db["users"][email]["nonce"])).encode("utf-8")).hexdigest();
    if value==htoken:
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




server=FastAPI()

@server.post("/reporting/{email}/{passwd}/{data}")
async def reporting("")

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
                        "quota":db["users"][email]["recharge"]}}
        elif deviceId!=db["users"][email]["device_id"] and db["users"][email]["device_id"]!="default":
            return {"status":"ADR"}
        elif deviceId==db["users"][email]["device_id"]:
            return {"status":"success",
                                "data":{"email":email,
                                    "quota":db["users"][email]["recharge"]}}
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
        response.set_cookie(key="cr",value=db["users"][signup.email]["recharge"]);
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
        db["users"][req["userEmail"]]["recharge"]+=int(req["plan"]);
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


    

    
    

