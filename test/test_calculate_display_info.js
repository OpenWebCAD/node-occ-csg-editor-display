const util = require("util");
const calculate_display_info = require("../server/calculate_display_info").calculate_display_info;
const should = require("should");
const async = require("async");

const geometry_editor = require("node-occ-csg-editor");

describe("CalculateDisplayInfo", function () {


    it("should calculate display information for a simple geometry shape", function (done) {

        const g = new geometry_editor.GeometryEditor();
        const b = g.addBox();
        b.point1.set(0, 0, 0);
        b.point2.set(100, 200, 200);
        b.isVisible = true;


        calculate_display_info(g, function (err, result) {

            if (err) {
                return done(err);
            }
            //xx console.log("displayCache", result.displayCache);
            //xx console.log("result", result);

            result.displayCache[b._id].hash.should.eql("13c9a8f52b4e00996dc18ffd0775f2e7d923381e");
            result.meshes[b._id].mesh.should.be.instanceOf(Object);
            should.not.exist(result.displayCache[b._id].err);
            done();
        });
    });

    it("should calculate display information when building a element raises an exception", function (done) {
        const g = new geometry_editor.GeometryEditor();
        const b = g.addBox();
        b.point1.set(0, 0, 0);
        b.point2.set(0, 0, 0); // intentionally, an empty box
        b.isVisible = true;


        calculate_display_info(g, function (err, result) {

            if (err) {
                //xx console.log("err =",err);
                return done(err);
            }
            //xx console.log("displayCache", result.displayCache);
            //xx console.log("result", result);

            should.not.exist(result.displayCache[b._id].hash);
            result.displayCache[b._id].err.should.eql("cannot build box");

            done();
        });
    });

    it("should calculate display information and skipped already known entities", function (done) {


        const g = new geometry_editor.GeometryEditor();
        const b = g.addBox();
        b.point1.set(0, 0, 0);
        b.point2.set(100, 100, 20);
        b.isVisible = true;

        const c = g.addCylinder();
        c.isVisible = true;
        c.point1.set(50, 50, -10);
        c.point2.set(50, 50, 30);
        c.radius.set(20);

        const s = g.addCutOperation(b, c);
        s.isVisible = true;

        async.series([

            function (callback) {

                calculate_display_info(g, function (err, result) {
                    if (err) {
                        return callback(err);
                    }


                    g.displayCache[b._id].hash.should.eql("439f2be0b62be87306dbba4b702d06015364a1da");
                    g.displayCache[c._id].hash.should.eql("5d754c32fa04cbdf95d704103198da616ea194cb");
                    g.displayCache[s._id].hash.should.eql("2cd2d488c755c16c44398c0dac95f27baeb22cdb");

                    result.meshes[b._id].mesh.should.be.instanceOf(Object);
                    result.meshes[c._id].mesh.should.be.instanceOf(Object);
                    result.meshes[s._id].mesh.should.be.instanceOf(Object);

                    //xx console.log(util.inspect(g.displayCache, {colors: true}));
                    callback(err);
                });

            },
            function (callback) {

                c.point1.set(50 + 1, 50, -10);
                c.point2.set(50 + 1, 50, 30);

                callback();
            },

            function (callback) {

                calculate_display_info(g, function (err, result) {
                    if (err) {
                        return callback(err);
                    }


                    g.displayCache[b._id].hash.should.eql("439f2be0b62be87306dbba4b702d06015364a1da");

                    g.displayCache[c._id].hash.should.eql("7c233142412ea7bc6ebc72e850d6578515a47d4b");
                    g.displayCache[s._id].hash.should.eql("3c3941b4987dea21cd53703cfacef1c130dd2096");

                    result.meshes[b._id].mesh.should.eql("reuse");
                    result.meshes[c._id].mesh.should.be.instanceOf(Object);
                    result.meshes[s._id].mesh.should.be.instanceOf(Object);

                    //xx console.log(util.inspect(g.displayCache, {colors: true}));
                    callback(err);
                });

            },

        ], done);

    });

    it("should calculate display information for a parametrized shape", function (done) {

        const g = new geometry_editor.GeometryEditor();

        g.setParameters([{id: "length", value: 10}, {id: "thickness", value: 1}]);

        const b1 = g.addBox();
        b1.point1.set(0, 0, 0);
        b1.point2.set("$length", "$length", "$length");
        b1.isVisible = false;

        const b2 = g.addBox();
        b2.point1.set("$thickness", "$thickness", "$thickness");
        b2.point2.set("$length-$thickness", "$length-$thickness", "$length+10");
        b2.isVisible = false;

        const s = g.addCutOperation(b1, b2);
        s.isVisible = true;

        async.series([
            function (callback) {
                calculate_display_info(g, function (err, result) {

                    if (err) {
                        return done(err);
                    }
                    //xx console.log(util.inspect(result,{colors:true}));
                    //xx console.log("displayCache", result.displayCache);
                    //xx console.log("result", result);

                    result.displayCache[s._id].hash.should.eql("cbe05dc0295b76cb590abc7fbec33301dd266739");
                    result.meshes[s._id].mesh.should.be.instanceOf(Object);
                    callback();
                });

            },
            function(callback){
                // now change some parameters
                g.setParameter("length",20);
                g.setParameter("thickness",4);
                callback();
            },
            function (callback) {
                calculate_display_info(g, function (err, result) {

                    if (err) {
                        return done(err);
                    }

                    result.displayCache[s._id].hash.should.eql("40b1a9663f4f7b8b8a10e14642200be4cd0fd4a8");
                    result.meshes[s._id].mesh.should.be.instanceOf(Object);
                    callback();
                });
            },
        ], done);


    });
});
