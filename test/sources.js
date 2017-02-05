var assert = require("chai").assert;
var Init = require("../lib/init");
var fs = require("fs");
var path = require('path');
var mkdirp = require("mkdirp");
var async = require("async");
var Sources = require("../lib/sources.js");
var Contracts = require("../lib/contracts.js");

describe('lookups from external sources', function() {
  var config;
  var moduleSource = "pragma solidity ^0.4.2; import './ModuleDependency.sol'; contract Module {}";
  var moduleDependencySource = "pragma solidity ^0.4.2; contract ModuleDependency {}";
  var parentContractSource = "pragma solidity ^0.4.2; import 'fake_source/contracts/Module.sol'; contract Parent {}";

  before("Create a sandbox", function(done) {
    this.timeout(5000);
    Init.sandbox(function(err, result) {
      if (err) return done(err);
      config = result;

      fs.writeFile(path.join(config.contracts_directory, "Parent.sol"), parentContractSource, {encoding: "utf8"}, done());
    });
  });

  before("Create a fake npm source", function(done) {
    var fake_source_path = path.join(config.working_directory, "node_modules", "fake_source", "contracts");

    async.series([
      mkdirp.bind(mkdirp, fake_source_path),
      fs.writeFile.bind(fs, path.join(fake_source_path, "Module.sol"), moduleSource, {encoding: "utf8"}),
      fs.writeFile.bind(fs, path.join(fake_source_path, "ModuleDependency.sol"), moduleDependencySource, {encoding: "utf8"})
    ], done)
  });

  it('successfully finds the correct source via Sources lookup', function(done) {
    Sources.find("fake_source/contracts/Module.sol", config.sources, function(err, body) {
      if (err) return done(err);

      assert.equal(body, moduleSource);
      done();
    });
  });

  it("errors when module does not exist from any source", function(done) {
    Sources.find("some_source/contracts/SourceDoesNotExist.sol", config.sources, function(err, body) {
      if (!err) {
        return assert.fail("Source lookup should have errored but didn't");
      }

      assert.equal(err.message, "Could not find some_source/contracts/SourceDoesNotExist.sol from any sources");
      done();
    });
  });

  it("contract compiliation successfully picks up modules and their dependencies", function(done) {
    this.timeout(10000);

    Contracts.compile(config.with({
      quiet: true
    }), function(err, contracts) {
      if (err) return done(err);

      var contractNames = Object.keys(contracts);

      assert.include(contractNames, "Parent");
      assert.include(contractNames, "Module");
      assert.include(contractNames, "ModuleDependency");

      done();
    })
  });
});
