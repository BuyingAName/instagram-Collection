var https = require('https');

//make the default node https function return a promise with the response in JSON format
function getContent(url) {
	return new Promise((resolve, reject) => {
		var request = https.get(url, (response) => {
			var body ='';
			response.on('data', (d) => body += d);
			response.on('end', () => resolve(JSON.parse(body)));
		});
		request.on('error', (err) => reject(err));
	});
};

function validateParams(tag, start, end) {
	//Hashtags cannot contain special characters or spaces
	var regex = new RegExp('[$-/:-?{-~!"^`\[\]\s]');
	if(regex.test(tag)) return false;
	if(start %1 != 0 || start < 0) return false;
	if(end %1 != 0 || end < 0) return false;
	if(start >= end) return false;
	return true;
};

//While loop using promises
function promiseWhile(condition, action) {
	return new Promise((resolve, reject) => {
		var loop = function() {
			if(!condition()) resolve();	
			else Promise.resolve(action()).then(loop, reject);
		};
		process.nextTick(loop);
	});	
};

module.exports = {
	getContent: getContent,
	validateParams: validateParams,
	promiseWhile: promiseWhile
};
