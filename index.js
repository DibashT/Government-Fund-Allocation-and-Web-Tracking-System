const express=require("express");
const path=require("path");
const bcrypt=require("bcrypt");
const collection=require("./config");

const app=express();
app.use(express.json());
app.use(express.urlencoded({extended:false}));

app.set("view engine","ejs");

app.use(express.static("public"))

app.get("",(req,res)=>{
  res.render("login");
}
)

app.get("/signup",(req,res)=>{
  res.render("signup"); 
})

app.post("/signup",async(req,res)=>{
  const data={
    name:req.body.username,
    password:req.body.password
  }
  const existingUser=await collection.findOne({name:data.name});
  if(existingUser){
    res.send("user already exists. Choose another name");
  }else{
    //hash the password
    const saltRounds=10;
    const hashedPassword=await bcrypt.hash(data.password,saltRounds);

    data.password=hashedPassword;

    const userdata=await collection.insertMany(data);
    console.log(userdata);
    res.redirect("/login");
  }

}); 

//Login
app.post("/login",async(req,res)=>{
  try{
    const checkUser=await collection.findOne({name:req.body.username});
    if( !checkUser){
      res.send("user not found");
    }
    const passwordMatch=await bcrypt.compare(req.body.password,checkUser.password);
    if(passwordMatch){
      res.render("home");
    }else{
      req.send("wrong password");
    }
  }catch{
    res.send("Fill the information correctly");
  }   
})




const port=5000;
app.listen(port,()=>console.log(`server is running at ${port}`));

