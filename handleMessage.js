 var  db = require('../../src/node/db/DB').db,
     API = require('../../src/node/db/API.js'),
   async = require('../../src/node_modules/async'),
settings = require('../../src/node/utils/Settings');

var pluginSettings = settings.ep_narration;

// When a new NARRATION_SAVE message comes in from the client
exports.handleMessage = function(hook_name, context, callback){
  if (context.message && context.message.data){
    if (context.message.data.type == 'NARRATION_SAVE' ) { // if it's a request to save a narration

      db.set("ep_narration" + padId, context.message.data); // stick it in the database
      context.client.json.send({ type: "COLLABROOM",
        data:{
          type: "narrationSaveSuccess",
          payload: true
        }
      });

    }
  }
  callback();
}

// When a new NARRATION_LOAD message comes in from the client
exports.handleMessage = function(hook_name, context, callback){
  if (context.message && context.message.data){
    if (context.message.data.type == 'NARRATION_LOAD' ) { // if it's a request to save a narration

      db.get("ep_narration" + padId, function(err, value){ // get the current value
        context.client.json.send({ type: "COLLABROOM",
          data:{
            type: "narrationLoadSuccess",
            data: value,
            payload: true
          }
        });
      });

    }
  }
  callback();
}

