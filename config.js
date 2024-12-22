
const mongoose=require("mongoose");
const connect=mongoose.connect("mongodb://localhost:27017/GovernmentFund");

//check database connection
connect.then(()=>{
  console.log("connected to database successfully");
})
.catch(()=>{
  console.log("failed to connect to database");
});

//create a schema
const  userSchema=new mongoose.Schema({
  name:{
    type:String,
    required:true
  },
  password:{
    type:String,
    required:true
  }
  
});

const collection=mongoose.model("user",userSchema);   

module.exports=collection;
