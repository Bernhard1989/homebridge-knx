/**
 * Everything that deals with receiving telegrams from the bus.
 * Uses callbacks to notify listeners.
 */

var knxd = require('eibd');

//array of registered addresses and their callbacks
var subscriptions = []; 
//check variable to avoid running two listeners
var running; 

function groupsocketlisten(opts, callback) {
	var conn = knxd.Connection();
	conn.socketRemote(opts, function(err) {
		if (err) {
			// a fatal error occurred
			console.log("FATAL: knxd or eibd not reachable");
			throw new Error("Cannot reach knxd or eibd service, please check installation and knx_config.json");
		}
		conn.openGroupSocket(0, callback);
	});
}


var registerSingleGA = function registerSingleGA (groupAddress, callback, reverse) {
	subscriptions.push({address: groupAddress, callback: callback, reverse:reverse });
};

/*
 * public busMonitor.startMonitor()
 * starts listening for telegrams on KNX bus
 * 
 */ 
var startMonitor = function startMonitor(opts) {  // using { host: name-ip, port: port-num } options object
	if (!running) {
		running = true;
	} else {
		console.log("<< knxd socket listener already running >>");
		return null;
	}
	console.log(">>> knxd groupsocketlisten starting <<<");	
	groupsocketlisten(opts, function(parser) {
		//console.log("knxfunctions.read: in callback parser");
		parser.on('write', function(src, dest, type, val){
			// search the registered group addresses
			//console.log('recv: Write from '+src+' to '+dest+': '+val+' ['+type+'], listeners:' + subscriptions.length);
			for (var i = 0; i < subscriptions.length; i++) {
				// iterate through all registered addresses
				if (subscriptions[i].address === dest) {
					// found one, notify
					//console.log('HIT: Write from '+src+' to '+dest+': '+val+' ['+type+']');
					subscriptions[i].lastValue = {val: val, src: src, dest: dest, type: type, date:Date()};
					subscriptions[i].callback(val, src, dest, type, subscriptions[i].reverse);
				}
			}
		});

		parser.on('response', function(src, dest, type, val) {
			// search the registered group addresses
//			console.log('recv: resp from '+src+' to '+dest+': '+val+' ['+type+']');
			for (var i = 0; i < subscriptions.length; i++) {
				// iterate through all registered addresses
				if (subscriptions[i].address === dest) {
					// found one, notify
//					console.log('HIT: Response from '+src+' to '+dest+': '+val+' ['+type+']');
					subscriptions[i].lastValue = {val: val, src: src, dest:dest, type:type, date:Date()};
					subscriptions[i].callback(val, src, dest, type, subscriptions[i].reverse);
				}
			}

		});

		
		// check if a tiny web server could show current status *******************************************************************************
		// Create a server with a host and port
		var server = new Hapi.Server();
		server.connection({ port: 3000 });

		server.route({
		    method: 'GET',
		    path: '/',
		    handler: function (request, reply) {
		    	var answer = "<html><title>Subscriptions</title><body>";
		    	var name, nextlevelname;
		    	answer += "<TABLE>";
		    	for (var i = 0; i < subscriptions.length; i++) {
		    		answer += "<TR>";
		    		for (name in  subscriptions[i]) {
		    		    if (typeof subscriptions[i][name] !== 'function') {
		    		    	if (typeof subscriptions[i][name] !== 'object' ) {
		    		    		answer += ("<TD>" + name + ': ' + subscriptions[i][name] +"</TD>"); 
		    		    	} else {
		    		    		for (nextlevelname in  subscriptions[i][name]) {
		    		    		    if (typeof subscriptions[i][name][nextlevelname] !== 'function') {
		    		    		    	if (typeof subscriptions[i][name][nextlevelname] !== 'object' ) {
		    		    		    		answer += ("<TD>" + nextlevelname + ': ' + subscriptions[i][name][nextlevelname]) + "</TD> ";
		    		    		    	} 
		    		    		    } 
		    		    		}
		    		    	}
		    		    } 
		    		}
		    		answer += "</TR>";
		    	}
		        reply(answer + "</body></html>");
		    }
		});

		server.route({
		    method: 'GET',
		    path: '/{name}',
		    handler: function (request, reply) {
		        reply('Hello, ' + encodeURIComponent(request.params.name) + '!');
		    }
		});

		server.start(function () {
		    console.log('Server running at:', server.info.uri);
		});
		
		
		
		
	}); // groupsocketlisten parser
}; //startMonitor


/*
 *  public registerGA(groupAdresses[], callback(value))
 *  parameters
 *  	callback: function(value, src, dest, type) called when a value is sent on the bus
 *  	groupAddresses: (Array of) string(s) for group addresses
 * 
 *  
 *  
 */
var registerGA = function (groupAddresses, callback) {
	// check if the groupAddresses is an array
	if (groupAddresses.constructor.toString().indexOf("Array") > -1) {
		// handle multiple addresses
		for (var i = 0; i < groupAddresses.length; i++) {
			if (groupAddresses[i] && groupAddresses[i].match(/(\d*\/\d*\/\d*)/)) { // do not bind empty addresses or invalid addresses
				// clean the addresses
				registerSingleGA (groupAddresses[i].match(/(\d*\/\d*\/\d*)/)[0], callback,groupAddresses[i].match(/\d*\/\d*\/\d*(R)/) ? true:false );
			}
		}
	} else {
		// it's only one
		if (groupAddresses.match(/(\d*\/\d*\/\d*)/)) {
			registerSingleGA (groupAddresses.match(/(\d*\/\d*\/\d*)/)[0], callback, groupAddresses.match(/\d*\/\d*\/\d*(R)/) ? true:false);
		}
	}
//	console.log("listeners now: " + subscriptions.length);
};



module.exports.registerGA = registerGA;
module.exports.startMonitor = startMonitor;
