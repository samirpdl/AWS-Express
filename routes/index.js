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
  var rds = [];
  var s3 = [];
  var instances = [];
  var projects = [];

  ec2.describeRegions({}, function (err, regions) {
    if (err) console.log(err, err.stack); // an error occurred
    regions.Regions.forEach(function (region) {
      let regionec2 = new AWS.EC2({ apiVersion: '2016-11-15', region: region.RegionName });
      let regionrds = new AWS.RDS({ apiVersion: '2016-11-15', region: region.RegionName });
      let regions3 = new AWS.S3({ apiVersion: '2016-11-15', region: region.RegionName });
      var rdsCounter = 0;
      var s3Counter = 0;
      regionrds.describeDBInstances({}, function (err, rdsData) {
        if (err) console.log(err, err.stack); // an error occurred

        rdsData.DBInstances.forEach(function (instance) {
          var params = {
            ResourceName: instance.DBInstanceArn,
          };
          regionrds.listTagsForResource(params, function (err, data) {
            instance.tags = data.TagList;
            if (rdsCounter === rdsData.DBInstances.length - 1) {
              rds = rdsData.DBInstances;
              regionec2.describeInstances({}, function (err, data) {
                if (err) console.log(err, err.stack); // an error occurred
                reservations.push(...data.Reservations);
                regions3.listBuckets({}, function (err, bucketData) {
                  bucketData.Buckets.forEach(function (bucket) {
                    var params = {
                      Bucket: bucket.Name
                    };
                    regions3.getBucketTagging(params, function (err, data) {
                      bucket.tags = data ? data.TagSet : [];
                      bucket.AvailabilityZone = region.RegionName;
                      if (s3Counter === bucketData.Buckets.length - 1) {
                        s3.push(...bucketData.Buckets);
                        showResult();
                      }
                      s3Counter++;
                    });
                  });
                });
              });
            }
            rdsCounter++;
          });
        });
      })
    })
  });

  function showResult() {
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

          instance.type = "ec2";
          if (tag.Key === "Deployment") {
            instance.environment = tag.Value
          }

          if (tag.Key === "OS Platform") {
            instance.os = tag.Value
          }
          if (tag.Key === "Name") {
            instance.name = tag.Value
          }
          if (tag.Key === "Services") {
            instance.services = tag.Value
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
    });
    rds.forEach(function (instance) {
      let tags = instance.tags
      instance.type = "rds";
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
        if (tag.Key === "Services") {
          instance.services = tag.Value;
        } else {
          instance.services = instance.Engine;
        }

        if (instances[tag.Value] !== undefined) {
          instances[tag.Value].push(instance)
        } else {
          if (instances["NoProject"] === undefined) {
            instances["NoProject"] = [];
          }
          instances["NoProject"].push(instance)
        }
      });
    });

    s3.forEach(function (instance) {
      let tags = instance.tags
      instance.type = "S3";
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
        }else{
          instance.name = instance.Name;
        }
        if (tag.Key === "Services") {
          instance.services = tag.Value;
        } else {
          instance.services = "S3"
        }

        if (instances[tag.Value] !== undefined) {
          instances[tag.Value].push(instance)
        } else {
          if (instances["NoProject"] === undefined) {
            instances["NoProject"] = [];
          }
          instances["NoProject"].push(instance)
        }
      });
    });


    showResponse();
  }

  function showResponse() {
    var responseInstance = [];
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
        let publicIp = "-";
        let publicDns = "-";
        if (ins.NetworkInterfaces && ins.NetworkInterfaces[0].Association !== undefined) {
          publicIp = ins.NetworkInterfaces[0].Association.PublicIp;
          publicDns = ins.NetworkInterfaces[0].Association.PublicDnsName;
        } else if (ins.Endpoint) {
          publicDns = ins.Endpoint.Address;
        }
        let server = {
          "name": ins.name,
          "type": ins.type,
          "environment": ins.environment ? ins.environment : "-",
          "ip": publicIp ? publicIp : "-",
          "os": ins.os ? ins.os : "-",
          "account": "aws@leapfrog",
          "location": ins.Placement ? ins.Placement.AvailabilityZone : (ins.AvailabilityZone ? ins.AvailabilityZone : "-"),
          "status": ins.State ? ins.State.Name : (ins.DBInstanceStatus ? ins.DBInstanceStatus : "-"),
          "domain": publicDns,
          "services": ins.services ? ins.services : "-"
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
    });
    res.json(responseInstance);
  }

});

module.exports = router;
