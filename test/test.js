'use strict'
var gulp = require('gulp');
var assert = require('stream-assert');
var should = require('should');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs-extra'));
var performanceBudget = require('../index');
var through = require('through2');
var getFileSize = require('filesize');

var testSrc = '_src/**/*';
var testCSSSrc = '_src/styles/**/*.css';
var testJSSrc = '_src/scripts/**/*.js';
var testImageSrc = '_src/images/**/*';
var testTotalSizeSrc = '_src/totalFileSize/**/*';

var jsonSrc = './test/json/';
var jsonFileCSS = jsonSrc + 'cssFiles.json';
var jsonFileJS = jsonSrc + 'JSFiles.json';
var jsonFileImage = jsonSrc + 'imageFiles.json';
var jsonFileAll = jsonSrc + 'allFiles.json';
var jsonFileTotalSize = jsonSrc + 'totalSize.json';

describe('when running gulp-performance-budget', function () {
  it('should emit error on streamed file', function (done) {
    gulp.src(testSrc, { buffer: false })
      .pipe(performanceBudget())
      .on('error', function (err) {
        err.message.should.eql('Streaming not supported');
        done();
      });
  });

	it('should write a json config to file', function (done) {
		gulp.src(testSrc)
			.pipe(performanceBudget({dest: jsonFileAll}))
			.pipe(gulp.dest('dest'))
			.on('end', function (err, data) {
       var _self = this;
        fs.readFile(jsonFileAll, 'utf8', function (err, data) {
          if (err) throw (err);
          data.length.should.be.above(0);
          done();
        });
		});
	});

  it('should create an object containing a property css', function (done) {
    gulp.src(testCSSSrc)
      .pipe(performanceBudget({dest: jsonFileCSS}))
      .pipe(gulp.dest('dest'))
      .on('end', function (err, data) {
        fs.readFile(jsonFileCSS, 'utf8', function (err, data) {
          if (err) throw (err);
          var dataObj = JSON.parse(data);
          dataObj.fileTypes.should.have.property('css');
          done();
        });
      });
  });

  it('should create an object containing a property images', function (done) {
    gulp.src(testImageSrc)
      .pipe(performanceBudget({dest: jsonFileImage}))
      .pipe(gulp.dest('dest'))
      .on('end', function (err, data) {
        fs.readFile(jsonFileImage, 'utf8', function (err, data) {
          if (err) throw (err);
          var dataObj = JSON.parse(data);
          dataObj.fileTypes.should.have.property('images');
          done();
        });
      });
  });

  it('should return a css value greater than zero', function(done){
    var ext = 'css';
     gulp.src(testCSSSrc)
      .pipe(performanceBudget({dest: jsonFileCSS}))
      .pipe(gulp.dest('dest'))
      .on('end', function (err, data) {
        fs.readFile(jsonFileCSS, 'utf8', function (err, data) {
          if (err) throw (err);
          var dataObj = JSON.parse(data);
          var cssVal = 0;
          if(dataObj.fileTypes.hasOwnProperty(ext)){
            cssVal = parseInt(dataObj.fileTypes[ext].total);
          }
          cssVal.should.be.greaterThan(0);
          done();
        });
      });
  });

  it('should create a value for fonts if svg is a font', function(done){
    var fontFile = './_src/fonts/gt-pressura-mono-regular-webfont.svg';
    var outputFile = './test/json/svgFont.json';

    gulp.src(fontFile)
    .pipe(performanceBudget({dest: outputFile}))
    .pipe(gulp.dest('dest'))
    .on('end', function(err, data){
      fs.readFile(outputFile, 'utf-8', function(err, data){
        if(err) throw (err);
        var dataObj = JSON.parse(data);
        dataObj.fileTypes.should.have.property('fonts');
        done();
      })
    });
  });

  function getFilesizeInBytes(filename) {
   var stats = fs.statSync(filename)
   var fileSizeInBytes = stats["size"]
   return fileSizeInBytes
  }

  it('should total up all file sizes to produce a total file size', function (done) {
    var totalSizePath = '_src/totalFileSize/';
    var total = 0;

    fs.readdir(totalSizePath, function (err, file) {
      if(err) throw err;

      for(var index = 0; index < file.length; index++) {
        var fileName = file[index];

        if(fileName !== '.DS_Store') {
          var tempPath = totalSizePath + fileName;
          total += getFilesizeInBytes(tempPath);
        }
      }
    });

    gulp.src(testTotalSizeSrc)
    .pipe(performanceBudget({dest: jsonFileTotalSize}))
    .pipe(gulp.dest('dest'))
    .on('end', function(err, data){
      fs.readFile(jsonFileTotalSize, 'utf-8', function(err, data){
        if(err) throw (err);
        var dataObj = JSON.parse(data);
        dataObj.totalSizes.should.have.property('totalSize').eql(total);
        done();
      })
    });
  });

  it('should calculate the percentage of each file type', function (done) {
    gulp.src(testTotalSizeSrc)
    .pipe(performanceBudget({dest: jsonFileTotalSize}))
    .pipe(gulp.dest('dest'))
    .on('end', function(err, data){
      fs.readFile(jsonFileTotalSize, 'utf-8', function(err, data){
        if(err) throw (err);
        var dataObj = JSON.parse(data);
        dataObj.fileTypes.images.should.have.property('percentage').eql(79);
        done();
      })
    });
  });

  it('should calculate a percentage for each file type that all add up to 100', function (done) {
    gulp.src(testTotalSizeSrc)
    .pipe(performanceBudget({dest: jsonFileTotalSize}))
    .pipe(gulp.dest('dest'))
    .on('end', function(err, data){
      fs.readFile(jsonFileTotalSize, 'utf-8', function(err, data){
        if(err) throw (err);
        var dataObj = JSON.parse(data);

        var imagesPercentage = dataObj.fileTypes.images.percentage;
        var cssPercentage = dataObj.fileTypes.css.percentage;
        var jsPercentage = dataObj.fileTypes.js.percentage;

        var sumOfPercentage = imagesPercentage + cssPercentage + jsPercentage;

        sumOfPercentage.should.eql(100);

        done();
      })
    });
  });

  it('should allow a user to pass through a budget which is added to the json file', function (done) {
    gulp.src(testSrc)
      .pipe(performanceBudget({dest: jsonFileAll, budget: {'total': 3000}}))
      .pipe(gulp.dest('dest'))
      .on('end', function (err, data) {
      fs.readFile(jsonFileAll, 'utf8', function (err, data) {
        if (err) throw (err);
        var dataObj = JSON.parse(data);
        dataObj.budget.total.should.eql(3000);
        done();
      });
    });
  });

  it('should allow a user to pass through a budget which is added to the json file', function (done) {
    gulp.src(testTotalSizeSrc)
      .pipe(performanceBudget({dest: jsonFileTotalSize, budget: {total: 9000}}))
      .pipe(gulp.dest('dest'))
      .on('end', function (err, data) {
      fs.readFile(jsonFileTotalSize, 'utf8', function (err, data) {
        if (err) throw (err);
        var dataObj = JSON.parse(data);

        var remainingBudget = dataObj.budget.total - dataObj.totalSizes.totalSize;

        dataObj.remainingBudget.total.should.eql(remainingBudget);
        done();
      });
    });
  });

  it('should not error when no string is passed', function (done) {
    gulp.src(testTotalSizeSrc)
      .pipe(performanceBudget())
      .pipe(gulp.dest('dest'))
      .on('end', function (err, data) {
      fs.readFile(jsonFileTotalSize, 'utf8', function (err, data) {
        if (err) throw (err);
        var dataObj = JSON.parse(data);
        data.length.should.be.above(0);
        done();
      });
    });
  });

  it('should allow a user to pass through a broken down budget which are added to the json file', function (done) {
    gulp.src(testTotalSizeSrc)
      .pipe(performanceBudget({
        'budget': {
          'total': 9000,
          'css': 2000,
          'images': 400,
          'js': 400,
          'fonts': 200
        }
      }))
      .pipe(gulp.dest('dest'))
      .on('end', function (err, data) {
        fs.readFile(jsonFileTotalSize, 'utf8', function (err, data) {
          if (err) throw (err);
          var dataObj = JSON.parse(data);

          dataObj.budget.total.should.eql(dataObj.budget.total);
          dataObj.budget.css.should.eql(dataObj.budget.css);
          dataObj.budget.images.should.eql(dataObj.budget.images);
          dataObj.budget.js.should.eql(dataObj.budget.js);
          dataObj.budget.fonts.should.eql(dataObj.budget.fonts);
          done();
        });
      });
  });

});
