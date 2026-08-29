from pydantic import BaseModel
from fastapi import FastAPI,Request,Response,Cookie
from fastapi.responses import FileResponse,RedirectResponse
from typing import Annotated
import pickle
import hashlib


db=pickle.load(open("DB.dsk","rb"))

def savetodisk():
    pickle.dump(db,open("DB.dsk","wb"))

def adduser(email,password,recharge):
    db["users"][email]={}
    db["users"][email]={"password":password,
                        "recharge":recharge,
                        "device_id":"default"}
    savetodisk();




server=FastAPI()

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
    token=request.headers.get("Authorization")
    
    req=await request.json()
    db["users"][req["userEmail"]]["recharge"]+=int(req["plan"]);

    
    

