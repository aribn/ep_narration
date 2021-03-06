var initialTimeStamp = 0; 

if(typeof exports == 'undefined'){
  var exports = this['mymodule'] = {};
}

// This is on the pad only, not the timeslider
exports.postTimesliderInit = function(hook, context){
  narration.timesliderInit();
}

exports.postAceInit = function(hook, context){
  narration.init();
}

/* What to do when we recieve the narration information from the server */
exports.handleClientTimesliderMessage_narrationLoadSuccess = function(hook, context){
  narration.recieve(context);
}

exports.aceEditEvent = function(hook_name, args, cb){
  if(args.callstack.docTextChanged){ // Has the doc changed?
    narration.event();
  }
}

var narration = {
  
  popcorn : null, 
  cues : {},

  event: function(){
    var timeStamp = new Date().getTime();
    var revNo = pad.getCollabRevisionNumber();
    // doing revNo as key would be way more efficient as we could check to see if it exists in object and avoid duplicates.
    if(!narration.cues[revNo]){
      narration.cues[revNo] = timeStamp - initialTimeStamp;
    }
    console.log(narration.cues);
  },

  /* When the user clicks the record button */
  record: function(e){
    narration.updateTimer(0);

    SC.record({
      start: function(){
        $("#recorderUI").show();
        narration.setRecorderUIState("recording");
        initialRevisionNumber = pad.collabClient.getCurrentRevisionNumber(); 
        recordingStartTime = ((+new Date()) - pad.clientTimeOffset);
        console.log("Audio recording started at: " + recordingStartTime);
      },
      progress: function(ms, avgPeak){
        console.log("SC.record - progress (nothing)");
        narration.updateTimer(ms);
      }
    });
    
    e.preventDefault();
  },

  
  /* After recording, sends the narration cues and URL to the server */
  send: function (){
    var padId = narration.getPadId();
    var url = narration.gup("narration_url");
  
    var data = {
      type      : 'NARRATION_SAVE',
      component : 'pad',
      cues      : narration.cues, // JSON.stringify(cues) ???
      url       : url, // or narration_url ??
      padId     : padId
    }
  
    console.log("about to send: ", data);
    console.log("narration.cues: ", narration.cues);
  
    pad.socket.json.send(
    {
      type: "COLLABROOM",
      component: "pad",
      data: data
    });
  
  },
  
  /* recieved cues from server, shove em into our page */
  recieve: function(msg){
    narration.cues = msg.payload.cues;    
    
    console.log("cues recieved:", narration.cues, msg);
    
    $.each(narration.cues, function(revision, timestamp) { 
      console.log("wiring:", timestamp, revision);
      popcorn.code({
        start: timestamp/1000.0, 
        onStart: function() {
          console.log("trying to update timeslider to rev."+revision);
          BroadcastSlider.setSliderPosition(revision);
        }
      });
    });
  },

  /* Requests the narration cues from the server */
  request: function(){
    console.log("in request()");
    
    var padId = narration.getPadId();
    var message = {};

    var data = {
      type      : 'NARRATION_LOAD',
      component : 'pad',
      padId     : padId
    }
    
    console.log("cues requested for: ", data);

    socket.json.send(
    {
      type: "COLLABROOM",
      component: "pad",
      data: data
    });
    // Will recieve a message back with either null or an object of cues <-> timestamps
  },

  /* Given a timestamp we move to a specific revision */
  moveToRev: function(timestamp){
    console.log("moving to TS", timestamp);
    // var revisionNumber = getRevisionNumberFromTimestamp(timestamp);
    // Do logic to move to X revision
  },

  render: function(narration_url){
    $(".soundcloud-url").attr("href", narration_url);
    
    $('#timeslider-wrapper').hide();
    popcorn = Popcorn.soundcloud( "#soundCloudTopContainer", narration_url, { frameAnimation: true } );    
    
    popcorn.media.addEventListener( "readystatechange", function() {
      $("#soundcloud-loading-placeholder").hide();
    });

    setTimeout(function(){ // TODO use a promise or something here, this is to avoid a race condition
      console.log("pre-request");
      narration.request();
      console.log("post-request");
    }, 1000);

  },

  gup: function(name, url) { // gets url parameters
    name = name.replace(/[\[]/, '\\\[').replace(/[\]]/, '\\\]');
    var results = new RegExp('[?&]'+name+'=?([^&#]*)').exec(url || window.location.href);
    return results == null ? null : decodeURIComponent(results[1]) || true;
  },

  timesliderInit: function(){
    var url = narration.gup("narration_url", window.location);
    console.log("timesliderInit url: ", url);
    if(url){
      narration.render(url);
    }
  },

  init: function(){ // inits the pad UI
    var port = (window.location.port) ? ":"+(window.location.port) : "";
    var redirect_uri = window.location.protocol + "//" + window.location.hostname + port + "/ep_narration/callback";
    console.log("redirect_uri", redirect_uri);
    SC.options.baseUrl = SC._baseUrl = "//connect.soundcloud.com";
    var x = SC.initialize({
      client_id: clientVars.soundcloudApiKey, // Note that the soundcloudApiKey comes from the clientVars that are passed to us from the Etherpad server
      redirect_uri: redirect_uri
    });
    console.log(x);
    
    $("#ep_narration_begin_recording").click(function(e){ // when the button is clicked begin recording
      narration.record(e);
    });
    
    
    $(document).on("click", "#recorderUI.recording #controlButton, #recorderUI.recording #stop", function(e){
      narration.setRecorderUIState("recorded");
      $(".secondary-link").show();
      SC.recordStop();
      e.preventDefault();
    });

    $(document).on("click", "#recorderUI.playing #controlButton", function(e){
      narration.setRecorderUIState("recorded");
      $(".secondary-link").show();
      SC.recordStop();
      e.preventDefault();
    });

    $(document).on("click", "#recorderUI.recorded #controlButton, #recorderUI.recorded #recording-preview", function(e){
      narration.updateTimer(0);
      narration.setRecorderUIState("playing");
      $(".secondary-link").hide();
      SC.recordPlay({
        progress: function(ms){
          narration.updateTimer(ms);
        },
        finished: function(){
          $(".secondary-link").show();
          narration.setRecorderUIState("recorded");
        }
      });
      e.preventDefault();
    });

    $(document).on("click", "#close-and-reset, #recording-cancel", function(e){
      $("#recorderUI").hide();
      // renderSketch(0);
      SC.recordStop();
      narration.setRecorderUIState("reset");
      e.preventDefault();
    });

    $(document).on("click", "#upload", function(e){
      narration.updateTimer(0);
      narration.setRecorderUIState("connecting");
      
      $("#upload-progress-meter").hide();
      $("#duringUploadControls .secondary-link").html("Connecting...");

      var playback_url = "http://" + location.host + "/p/" + clientVars.padId + "/timeslider"; 
      // switch to clientVars.readOnlyId

      SC.connect({
        connected: function(){
          narration.setRecorderUIState("uploading");
          $("#upload-progress-meter").show();
          $("#duringUploadControls .secondary-link").html("Uploading...");
          SC.recordUpload({
            track: {
              title: "narration_" + (new Date().getTime()), 
              sharing: "public", 
              description: "This track is the audio component of a <A HREF='http://"+window.location.hostname+"' target='_blank'>"+window.location.hostname+"</A> narration. <A HREF='"+playback_url+"' target='_blank'><B>Visit this narration</B></A> to hear me talk as I type.", 
              license: "cc-by-sa"
            }
          }, function(track){
            console.log(track);
            console.log(track.permalink_url);

            SC.put(
              "/tracks/" + track.id, 
              { 
                track: { 
                  title: "narration " + clientVars.readOnlyId, 
                  description: "This track is the audio component of a <A HREF='http://"+window.location.hostname+"' target='_blank'>"+window.location.hostname+"</A> narration. <A HREF='"+playback_url + "?narration_url=" + encodeURIComponent(track.permalink_url) + "' target='_blank'><B>Visit narration "+clientVars.readOnlyId+"</B></A> to hear me talk as I type."          
                } 
              }, 
              function(track) {
                console.log(this,arguments); 
              }
            );

            var sc_padview = "/p/"+ clientVars.padId +"/timeslider?narration_url=" + encodeURIComponent(track.permalink_url);
            $("#visit-narration").attr("href", sc_padview);

            narration.saveCueData(
              track.permalink_url, 
              function() {
                narration.setRecorderUIState("uploaded");
              }
            );
          });
        }
      });

      e.preventDefault();
    });
  },
  

  
  saveCueData: function(narration_url, callback) { 
    narration.send();
    callback();
  }, 
  
  
  
  updateTimer: function(ms){
    if (ms==0) {
      $("#timer").hide();  
      $(".secondary-link").show();
      initialTimeStamp = new Date().getTime();
    } else {
      var seconds = Math.floor(ms/1000.0) % 60;
      var minutes = Math.floor(Math.floor(ms/1000.0) / 60);
      var mins = (minutes < 10) ? "0"+minutes : ""+minutes;
      var secs = (seconds < 10) ? "0"+seconds : ""+seconds;
      $("#timer").text(mins+":"+secs);
      $("#timer").show();  
    }
  }, 

  setRecorderUIState: function(state){
    // state can be reset, recording, recorded, playing, uploading
    // visibility of buttons is managed via CSS
    $("#recorderUI").attr("class", state);
    
    console.log("setRecorderUIState('"+state+"')");
  }, 
  
  getPadId: function(){
    //get the padId out of the url
    var urlParts= document.location.pathname.split("/");
    return padId = decodeURIComponent(urlParts[2]);
  }
}

exports.narration = narration;

