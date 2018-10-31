var express = require('express');
var router = express.Router();

/* GET home page. */
var AWS = require('aws-sdk');
// Load credentials and set region from JSON file
AWS.config.loadFromPath('./cred.json');

// Create EC2 service object
var ec2 = new AWS.EC2({ apiVersion: '2016-11-15' });

router.get('/data', function (req, res, next) {

  var reservations = [];
  var counter = 0;
  ec2.describeRegions({}, function (err, regions) {
    if (err) console.log(err, err.stack); // an error occurred
    regions.Regions.forEach(function (region) {
      let regionec2 = new AWS.EC2({ apiVersion: '2016-11-15', region: region.RegionName });
      regionec2.describeInstances({}, function (err, data) {
        if (err) console.log(err, err.stack); // an error occurred
        reservations.push(...data.Reservations);


        if (counter === regions.Regions.length - 1) {
          var instances = [];
          var responseInstance = [];
          var projects = [];
          reservations.forEach(function (reservation) {
            reservation.Instances.forEach(function (instance) {
              let tags = instance.Tags;
              tags.forEach(function (tag) {
                if (tag.Key === "Project") {
                  if (instances[tag.Value] == undefined) {
                    instances[tag.Value] = [];
                    projects.push(tag.Value);
                  }
                }

                if (tag.Key === "Deployment") {
                  instance.environment = tag.Value
                }

                if (tag.Key === "OS Platform") {
                  instance.os = tag.Value
                }
                if (tag.Key === "Name") {
                  instance.name = tag.Value
                }

                if (instances[tag.Value] !== undefined) {
                  instances[tag.Value].push(instance)
                } else {
                  if (instances["NoProject"] === undefined) {
                    instances["NoProject"] = [];
                  }
                  instances["NoProject"].push(instance)
                }
              })
            })
          })


          projects.forEach(function (project) {
            let responseInstanceSingle = {
              "project": project,
              "environments": [],
            }

            let devInstances = {
              "title": "Development",
              "servers": []
            };

            let productionInstances = {
              "title": "Production",
              "servers": []
            };

            let uatInstances = {
              "title": "UAT",
              "servers": []
            };

            let stagingInstances = {
              "title": "Staging",
              "servers": []
            };

            let qaInstances = {
              "title": "QA",
              "servers": []
            };

            let multipleInstances = {
              "title": "Multiple Deployments",
              "servers": []
            };

            let noTagsInstances = {
              "title": "NoTags",
              "servers": []
            };

            let projectInstances = instances[project];

            projectInstances.forEach(function (ins) {
              let publicIp = "";
              let publicDns = "";
              if (ins.NetworkInterfaces[0].Association !== undefined) {
                publicIp = ins.NetworkInterfaces[0].Association.PublicIp;
                publicDns = ins.NetworkInterfaces[0].Association.PublicDnsName;
              }
              let server = {
                "name": ins.name,
                "type": "",
                "environment": ins.environment,
                "ip": publicIp,
                "os": ins.os,
                "account": "aws@leapfrog",
                "location": ins.Placement.AvailabilityZone,
                "status": ins.State.Name,
                "domain": publicDns
              };
              if (ins.environment === "Development") {
                devInstances.servers.push(server);
              } else if (ins.environment === "Production") {
                productionInstances.servers.push(server);
              } else if (ins.environment === "User Acceptance") {
                uatInstances.servers.push(server);
              } else if (ins.environment === "Staging") {
                stagingInstances.servers.push(server);
              } else if (ins.environment === "Quality Assurance") {
                qaInstances.servers.push(server);
              } else if (ins.environment === "Multiple") {
                multipleInstances.servers.push(server);
              } else {
                noTagsInstances.servers.push(server);
              }
            });

            if (devInstances.servers.length > 0) {
              responseInstanceSingle.environments.push(devInstances);
            }
            if (qaInstances.servers.length > 0) {
              responseInstanceSingle.environments.push(qaInstances);
            }
            if (stagingInstances.servers.length > 0) {
              responseInstanceSingle.environments.push(stagingInstances);
            }
            if (uatInstances.servers.length > 0) {
              responseInstanceSingle.environments.push(uatInstances);
            }
            if (productionInstances.servers.length > 0) {
              responseInstanceSingle.environments.push(productionInstances);
            }
            if (multipleInstances.servers.length > 0) {
              responseInstanceSingle.environments.push(multipleInstances);
            }
            if (noTagsInstances.servers.length > 0) {
              responseInstanceSingle.environments.push(noTagsInstances);
            }
            responseInstance.push(responseInstanceSingle)
          })



          res.json(responseInstance);
        }
        counter++;


      });
    });
  });
});

module.exports = router;
