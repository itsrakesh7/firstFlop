var mqtt=require('mqtt');
var log= require('./trace');
var config=require("./config");
var fs = require('fs');
var gJasonObject = JSON.parse(fs.readFileSync('./iotConfigs.json', 'utf8'));
var gDeviceState = "INIT";
var cloudIp = "mqtt://test1.mosquitto.org/1883";
//var localBrokerIp="mqtt://localhost";
var localBrokerIp = "mqtt://iot.eclipse.org";
//var localBrokerIp = "mqtt://test.mosquitto.org/1883"
var myID = config.myID;


//test
var gState="OFF"

//Connecting to cloud
console.log("Connecting to cloud");
var client = mqtt.connect(cloudIp,
		           {clientId:myID,
		            keepalive:20,
    			    clean:1
    			   }  
			 );

console.log('Connecitng to local Broker' +localBrokerIp);
var localClient = mqtt.connect(localBrokerIp,
		           {clientId:myID,
		            keepalive:20,
    			    qos:1,
    			    retain:true	
    			   }  
			 );

//Handle Error
client.on("error",function(error){
console.log("Can't connect" + error);
process.exit(1)})

localClient.on("error",function(error){
console.log("Can't connect to local broker" + error);
process.exit(1)})

//Publish 
var topic_list=[myID+"/ACTION",myID+"/STATUS"];
var pub_topic_action = myID+"/ACTION";
var pub_topic_status = myID+"/STATUS";
var pub_topic_register = myID+"/REGISTER";

//Publish from device
var pub_device_register="/+/+/REGISTER";
var pub_device_de_register= "/+/+/DEREGISTER";
var pub_device_status= "/+/+/STATUS";

var actionMessage = {   
             	"type": "LP",
	        "index":"1",
		"mapping":{ "id":"lp1", "des":"null","link":"1", "state":"1"}
	      }
var msgFromDevice = "{\"type\": \"LP\",\"mapping\":{\"id\":\"lp1\",\"des\":\"t1\",\"link\":\"1\", \"state\":\"0\"}}"
		      
var options={
	retain:false,qos:1
}
//On connect: Subscribing to topic
client.on("connect",function(){	
	console.log("connected to cloud " +client.connected);
	//Now Subscribe to topics
	if(gDeviceState == "INIT"){
		client.subscribe(pub_topic_register,{qos:0,retain:false}); //topic list
		//var json = JSON.stringify(gJasonObject);
		client.publish(pub_topic_register,"TEST",options);
	}
})
//On connect: Subscribing to topic
localClient.on("connect",function(){
	var str;
	console.log("connected local broker " +localClient.connected);
	localClient.subscribe(pub_device_register,{qos:1,retain:true});
	localClient.subscribe(pub_device_de_register,{qos:1,retain:true});
	localPublish("GW_RESET","GW_RESET",{qos:1,retain:false});
})

function publishSubscribeAfterRegis()
{
	if(gDeviceState == "REGISTER"){
		//client.unsubscribe(pub_topic_register,{qos:1}); //topic list
 		console.log("subscribing");
		client.subscribe(pub_topic_action,{qos:1,retain:false}); //topic list
	 	var json = JSON.stringify(actionMessage);
		//client.publish(pub_topic,json,options);
		//var timer_id=setInterval(function(){publish(pub_topic_action,json,options);},10000);
	}
        else{
	    console.log(" # Invalid Satate of HUB" +gDeviceState);
	}

}
/************************* PUBLISH ****************************/
//publish function
function publish(topic,msg){
  console.log("## Publishing::" +topic +"::" +msg);
  if (client.connected == true){
   client.publish(topic,msg,options);}
   else {
	  console.log(" publishing Connect error" +client.connected);
   }
}
//publish function
function localPublish(topic,msg){
   console.log("## Publishing Local::" +topic +"::" +msg);
 
  if (localClient.connected == true){
   localClient.publish(topic,msg,options);
   }
   else {
	  console.log(" publishing Local Connect error " +localClient.connected);
   }
 }

/************************* SUBSSCRIBE ****************************/
//Subscriber call back
client.on('message',function(topic, message, packet){
	console.log("Received topic is "+ topic +" message " +message);
	switch(topic){
	  case pub_topic_action:
		 parseActionFromCl(message);
		 break;

	  case pub_topic_status:
		  break;

	  case pub_topic_register:
		  gDeviceState = "REGISTER";
		  publishSubscribeAfterRegis();
		  break;

	   default:
		  console.log("Received defaut msg" +topic +"with msg" +message);
		  break;
	}

	   
});
function convertDeviceMessageToJason(topic,message){
	var types = topic.split("/");
	var jason = JSON.parse(msgFromDevice);
	jason.type = types[1];
	jason.mapping.id = types[2];
	if(message == "1")
	     jason.mapping.state =1;
	else if(message == "0")
	     jason.mapping.state =0;
	else
	     console.log("Local Received " +message +" is not yet supported");
	return jason;
}
//Subscriber call back from local broker
localClient.on('message',function(topic, message, packet){
	var types = topic.split("/");
        console.log("Local Received topic is "+ topic +" message " +message  +"::" +types[1] +types[2]);
	switch(types[3]){
		case "REGISTER":
		     var jsonMessage = JSON.parse(message);
		     topic = createSubscribeTopicForDevices(jsonMessage);
		     console.log("Received registration from device, created topic" +jsonMessage.type +jsonMessage.mapping.id  +"::" +topic);
		     if(topic == "false") {
			//id = getDeviceIDForNewDevice(message);
		     	//message.mapping.id = id;
		     	//addDevcieToList(message);
		     }
		     	console.log("Device subscribing to STATUS for device " +types[2]);
			localClient.subscribe(topic,{qos:1,retain:true});
			topic = "/" + jsonMessage.type + "/" +jsonMessage.mapping.id +"/" +"ACCEPTED";
       			//+config.deviceRegistrationAccepted;
			localPublish(topic,jsonMessage.mapping.id);
			//Test
			//var timer_id=setInterval(function(){localPublish("/"+jsonMessage.type+"/"+jsonMessage.mapping.id +"/" +"ACTION","1",options);},5000);
		      break;
		case "DEREGISTER":
		     topic = createSubscribeTopicForDevices(message);
		     console.log("Received de-registration from device, created topic" +message +"::" +topic);
		     if(topic != "false") {
		     console.log("Device un-subscribing");
		     localClient.unsubscribe(topic); //topic list
		     }
		     break;

		case "STATUS":
		     console.log("got Status from device" +message +"::" +topic);
		     jasonMsg = convertDeviceMessageToJason(topic,message);
		     searchAndUpdate(topic,jasonMsg);
		     break;

		case "EMER":
		     break;

		 default:
			console.log("undefiend message from device" +message +"::" +topic);
	}
		     
});

function parseTypeFromCl(message){
	 //var jason = JSON.parse(message);
	 return message.type;
}
function parseIdFromCl(message){
	 //var jason = JSON.parse(message);
	 //return jason.mapping.id;
	 return message.mapping.id;
}
function parseStateFromCl(message){
	 //var jason = JSON.parse(message);
	 return message.mapping.state;
}
function parseIndexFromCI(message){
	 //var jason = JSON.parse(message);
	 return parseInt(message.index,10) -1;
}
function getStatesForIndexFromDb(type,index){
	console.log("getStatesForIndexFromDb " +type +" " +index);
	state = "undefined"
	switch(type){
		case "LP":
		     state = gJasonObject.GW.LP.mapping[index].state;
		     break;
		case "FP":
		     state = gJasonObject.GW.FP.mapping[index].state;
		     break;
		case "AP":
		     state = gJasonObject.GW.AP.mapping[index].state;
		     break;
		default:
		     log.f("deafult in getStatesForIndexFromDb" +type);
	}
	return state;

}
function createPublishTopicFromDb(type,index){
	var topic = "";
	switch(type){
		case "LP":
		     topic = gJasonObject.GW.LP.mapping[index].id+"/"+
			    gJasonObject.GW.LP.mapping[index].des+"/"+"ACTION";
		     break;
		case "FP":
		     topic = gJasonObject.GW.LP.mapping[index].id+"/"+
			    gJasonObject.GW.LP.mapping[index].des+"/"+"ACTION";
		     break;
		case "AP":
		     topic = gJasonObject.GW.LP.mapping[index].id+"/"+
			    gJasonObject.GW.LP.mapping[index].des+"/"+"ACTION";
		     break;
		default:
		     log.f("deafult in createPublishTopicFromDb" +type);
	}
	return topic;

}
function parseActionFromCl(message){
	//LOG(TAG_INFO," topic: " +topic +" message: " +message);
	var type = parseTypeFromCl(message);
	var index, currentState,nextState;
	var mapping;
	console.log( " action received type=" +type);
	switch(type){
		case "LP":
		    index = parseIndexFromCi(message);
		    currentState = getStatesForIndexFromDb(type,index);
         	    nextState = (parseInt((parseStateFromCl(message)),10)) ? "ON ":"OFF";
		    topic = createPublishTopicFromDb(type,index);
		    console.log("Action for LP " +index +currentState +nextState +" " +topic);
		    if( (mapping = searchForDeviceInDb(message))){
			console.log(" Action req device is found");
	   	        //publishToClient(topic,nextState);
			//Test code
			//newState = parseStateFromCl(message);	
	       		//console.log("updating state from" +mapping.state   +"to  " +newState);
	       		//mapping.state = newState;
			//var json = JSON.stringify(mapping);
			//console.log("updates MSG .." +json);
		    }		   
		    break;

	       case "FP":
		     break;

		default:
		console.log("Invalid type in jason message" +message);


			
	 }
}

function searchForDeviceInDb(message){
	var type  = parseTypeFromCl(message);
	var id = parseIdFromCl(message);
	var i,j;
	if(id == config.newDeviceID){
	   console.log("new deice found with type ", type);
	   return false;  
	}
	for(i=0; i< gJasonObject.GW.numType;i++){
		if(type == gJasonObject.GW.typeArray[i]){
		   switch(type){
			   case "LP":
			   for(j=0; j< gJasonObject.GW.LP.count;j++){
			       if(gJasonObject.GW.LP.mapping[j].id == id){
				  console.log("searchForDeviceInDb deice id found  " +id +type);
				  return gJasonObject.GW.LP.mapping[j];
			       }
			   }

			    case "FP":
			    for(j=0; j< gJasonObject.GW.FP.count;j++){
			       if(gJasonObject.GW.FP.mapping[j].id == id){
				  log.i("searchForDeviceInDb deice id found  " +id +type);
				  return gJasonObject.GW.LP.mapping[j];
			       }
			    }
			     case "AP":
			    for(j=0; j< gJasonObject.GW.AP.count;j++){
			       if(gJasonObject.GW.AP.mapping[j].id == id){
				  log.i("searchForDeviceInDb deice id found  " +id +type);
				  return gJasonObject.GW.LP.mapping[j];
			       }
			    }
		   }
		}
	}
	return false;
}	

function createSubscribeTopicForDevices(message){
	var topic = "false";
	var check= searchForDeviceInDb(message);
	if(check){
		console.log("Device type match found " +message.mapping.id);
		topic = "/" + message.type +"/" +message.mapping.id +"/" +"STATUS";
		console.log("Found Device type " +(message.type) +" "  +topic);
		}
	else{
		console.log("Device ID NOT found Adding entry " +message.type +message.mapping.id );
	}
	return topic;
}

function  publishToClient(topic,nextState){
	 localPublish(topic,nextState);
}

//log.e("messagsearchAndUpdatesearchAndUpdate + var , APPNAME, MODLENAME, bool);

function searchAndUpdate(topic, message){
	var mapping= searchForDeviceInDb(message);
	var newState;
	var stateStr="0";
	if(mapping){
	       newState = parseStateFromCl(message);	
	       console.log("updating state from" +mapping.state   +"to  " +newState);
	       mapping.state = newState;
	       if(newState == "0")
		    stateStr = "1";
	       else if(newState == "0")
		    stateStr = "0"; 
	       var timer_id=setTimeout(function(){localPublish("/LP/lp1/ACTION",stateStr,options);},500);
	      
	}
	else{
	    log.e(" searchAndUpdate device id not found" +topic);
	}
	return mapping;
}

//
// monitoring
// clients
 //  counters -> (system, custom, error) - Dash board
 //				       Alerts
				       //		Level
					//		S1
					//		S2

// Trace logs
// 	verbose - detail log
//	Info	- Logical breakpoints
//	notify	- call back
//	warning
//	error
//	critical

