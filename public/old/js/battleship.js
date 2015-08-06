/*
 * battleship.js
 * Root namebattleshipce module
*/

/*jslint           browser : true,   continue : true,
  devel  : true,    indent : 2,       maxerr  : 50,
  newcap : true,     nomen : true,   plusplus : true,
  regexp : true,    sloppy : true,       vars : false,
  white  : true
*/
/*global $, battleship */

var battleship = (function () {
  'use strict';
  var initModule = function ( $container ) {
    battleship.data.initModule();
    battleship.model.initModule();
    battleship.shell.initModule( $container );
  };

  var _localMethod = function(){
    alert("I am local function");
  };
  return { initModule: initModule };
}());
