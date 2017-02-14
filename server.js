// dependencies
const hapi = require('hapi');
const NunjucksHapi = require('nunjucks-hapi');
const Vision = require('vision');
const Path = require('path');
const Inert = require('inert');
const querystring = require('querystring');
const request = require('request');
const tough = require('tough-cookie');
const xml2js = require('xml2js');
const parser = new xml2js.Parser();

// required for self signed certs
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// application constants
require('dotenv').config();
const port = process.env.PORT;
const url = process.env.JAZZ_URL;
const jazz_user = process.env.JAZZ_USER;
const jazz_pass = process.env.JAZZ_PASS;

var cookieJar = request.jar(tough.cookieJar);
var server = new hapi.Server();
var projectAreas = [];

server.connection({
  host: 'localhost',
  port: process.env.PORT || port,
});

// authenticates and sets cookies
var authenticate = function() {
  return new Promise(function(fulfill, reject) {
    request({
      url: url + '/authenticated/identity',
      method: 'GET',
      followRedirects: true,
      jar: cookieJar
    }, function(error, response, body) {
      if (error) {
        console.log(error);
      } else {
        request({
          url: url + '/authenticated/j_security_check',
          method: 'POST',
          followRedirects: true,
          jar: cookieJar,
          form: {
            j_username: jazz_user,
            j_password: jazz_pass
          }
        }, function(error, response, body) {
          if (error) {
            console.log(error);
            reject(false);
          } else {
            fulfill(true);
          }
        });
      }
    });
  });
};

// get project areas to populate the form
var getProjectAreas = function() {
  return new Promise(function(fulfill, reject) {
    request({
      url: url + '/rpt/repository/foundation?fields=projectArea/projectArea/(name|itemId)',
      method: 'GET',
      followRedirects: true,
      jar: cookieJar
    }, function(error, response, body) {
      if (error) {
        console.log(error);
      } else {
        parser.parseString(body, function(err, result) {
          //console.log(result);
          if (typeof result == 'undefined' || typeof result.foundation.projectArea.length == 'undefined' || result.foundation.projectArea.length <= 0) {
            reject('project areas are undefined');
          } else {
            let projectAreas = [];
            for (var i = 0; i < result.foundation.projectArea.length; i++) {
              let area = {
                name: result.foundation.projectArea[i].name[0],
                itemId: result.foundation.projectArea[i].itemId[0]
              };
              projectAreas.push(area);
            }
            projectAreas.sort(function(a, b) {
              let nameA = String(a.name).toLowerCase(),
                nameB = String(b.name).toLowerCase();
              if (nameA < nameB) {
                return -1;
              }
              if (nameA > nameB) {
                return 1;
              }
              return 0;
            });
            fulfill(projectAreas);
          }
        });
      }
    });
  });
};

var getProjectAreaMembers = function(area_id) {
  return new Promise(function(fulfill, reject) {
    request({
      url: url + '/rpt/repository/foundation?fields=projectArea/projectArea[itemId=' + area_id + ']/teamMembers/(itemId|name)',
      method: 'GET',
      followRedirects: true,
      jar: cookieJar
    }, function(error, response, body) {
      parser.parseString(body, function(err, result) {
        if (typeof result.foundation.projectArea[0].teamMembers == 'undefined' || result.foundation.projectArea[0].teamMembers.length <= 0) {
          console.log('body is undefined');
          reject();
        } else {
          let projectMembers = [];
          for (var i = 0; i < result.foundation.projectArea[0].teamMembers.length; i++) {
            let member = {
              name: result.foundation.projectArea[0].teamMembers[i].name,
              itemId: result.foundation.projectArea[0].teamMembers[i].itemId
            };
            projectMembers.push(member);
          }
          projectMembers.sort(function(a, b) {
            let nameA = String(a.name).toLowerCase(),
              nameB = String(b.name).toLowerCase();
            if (nameA < nameB) {
              return -1;
            }
            if (nameA > nameB) {
              return 1;
            }
            return 0;
          });
          fulfill(projectMembers);
        }
      });
    });
  });
};


// build http request
var createWorkItem = function(dataObject) {
  // structure from https://jazz.net/wiki/bin/view/Main/ResourceOrientedWorkItemAPIv2#Creating_Work_Items
  let workItem = {
    "dc:title": dataObject.summary,
    "dc:description": dataObject.description,
    "dc:type": {
      "rdf:resource": url + '/oslc/types/' + dataObject.projectArea + '/task'
    },
    "rtc_cm:filedAgainst": {
      "rdf:resource": url + '/resource/itemOid/com.ibm.team.workitem.Category/' + dataObject.projectArea
    }
  };
  console.log('Endpoint: ', url + '/oslc/contexts/' + dataObject.projectArea + '/workitems');
  console.log('Work Item: ', workItem);
  //return new Promise(function(fulfill, reject) {
    request({
      url: url + '/oslc/contexts/' + dataObject.projectArea + '/workitems',
      method: 'POST',
      headers: {
        'Accept': 'text/json',
        'Content-Type': 'application/x-oslc-cm-change-request+json'
      },
      data: workItem,
      jar: cookieJar
    }, function(error, response, body) {
      if (error) {
        console.log('Error: ', error);
        //reject(error);
      } else {
        console.log('StatusCode: ', response.statusCode);
        console.log('Headers: ', response.headers)
        console.log('Body: ', body);
        // return the new work item number to redirect user to
        //fulfill(body.workItemNumber);
      }
    });
  //});
};

// primary route
server.route({
  method: ['GET', 'POST'],
  path: '/',
  handler: function(request, reply) {
    if (request.method === "post") {
      let formData = request.payload;
      createWorkItem(formData);
      return reply('');
    } else {
      reply.view('form', {
        title: 'New Work Item',
        projectAreas: projectAreas,
        projectMembers: ''
      });
    }
  }
});

// get members route
server.route({
  method: ['GET'],
  path: '/rest/getMembers/{area_id}',
  handler: function(request, reply) {
    getProjectAreaMembers(request.params.area_id).then(function(result) {
      //console.log(result);
      return reply(result);
    });
  }
});

server.register([Inert, Vision], function(err) {
  if (err) {
    throw err;
  }
  server.views({
    engines: {
      html: NunjucksHapi
    }
  });
});

// authenticate and get project areas to populate form
authenticate().then(function(authenticated) {
  if (authenticated) {
    // start server on successful authentication
    console.log('Starting Server...');
    getProjectAreas().then(function(result) {
      projectAreas = result;
      server.start();
    }, function(reason) {
      console.log('Failed to start because of: ', reason);
    });
  } else {
    console.log('Authentication Failed!');
  }
});
