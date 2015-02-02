/*
 * battleship.battle.js
 * battle feature module for battleship
*/

/*jslint         browser : true, continue : true,
  devel  : true, indent  : 2,    maxerr   : 50,
  newcap : true, nomen   : true, plusplus : true,
  regexp : true, sloppy  : true, vars     : false,
  white  : truef
*/

/*global $, battleship */

battleship.battle = (function () {
  'use strict';
  //---------------- BEGIN MODULE SCOPE VARIABLES --------------
  var
    configMap = {
      main_html : String()
        + '<div class="battleship-battle">'
        + '</div>',

      settable_map : {
      },

    },
    stateMap  = {
      $append_target    : null,
      my_arena          : {},
      enemy_arena       : {},
    },
    jqueryMap = {},

    setJqueryMap,  createArena,
    onReceiveAgonist, onAcceptAgonist, onUserListchange, onLogin,  onLogout,
    configModule,  initModule,
    removeSlider,  handleResize,
    cell;
  //----------------- END MODULE SCOPE VARIABLES ---------------

  //------------------- BEGIN UTILITY METHODS ------------------
  //-------------------- END UTILITY METHODS -------------------

  //--------------------- BEGIN DOM METHODS --------------------
  // Begin DOM method /setJqueryMap/
  setJqueryMap = function () {
    var
      $append_target = stateMap.$append_target;

    jqueryMap = {
      $battle   : $append_target.find('.battleship-battle'),
      $window   : $(window)
    };
  };
  // End DOM method /setJqueryMap/
  //---------------------- END DOM METHODS ---------------------

  //------------------- BEGIN EVENT HANDLERS -------------------

  onReceiveAgonist = function ( event, arg_map ) {
    var conf;

    conf = alert("Opponent found: "+arg_map.sender_name);
  };

  onAcceptAgonist = function( event, arg_map ){
    var accepted = arg_map.accepted;
    if(accepted){
      alert("You and "+arg_map.sender_name + " are accepted to fight.");
    }else{
      alert(arg_map.sender_name+" has not accepted you.");
    }
  };

  onLogin = function ( event, login_user ) {
  };

  onLogout = function ( event, logout_user ) {
  };

  //-------------------- END EVENT HANDLERS --------------------

  //------------------- BEGIN PUBLIC METHODS -------------------
  // Begin public method /configModule/
  // Example   : battleship.battle.configModule({ slider_open_em : 18 });
  // Purpose   : Configure the module prior to initialization
  // Arguments :
  //   * set_battle_anchor - a callback to modify the URI anchor to
  //     indicate opened or closed state. This callback must return
  //     false if the requested state cannot be met
  //   * battle_model - the battle model object provides methods
  //       to interact with our instant messaging
  //   * people_model - the people model object which provides
  //       methods to manage the list of people the model maintains
  //   * slider_* settings. All these are optional scalars.
  //       See mapConfig.settable_map for a full list
  //       Example: slider_open_em is the open height in em's
  // Action    :
  //   The internal configuration data structure (configMap) is
  //   updated with provided arguments. No other actions are taken.
  // Returns   : true
  // Throws    : JavaScript error object and stack trace on
  //             unacceptable or missing arguments
  //
  configModule = function ( input_map ) {
    battleship.util.setConfigMap({
      input_map    : input_map,
      settable_map : configMap.settable_map,
      config_map   : configMap
    });
    return true;
  };
  // End public method /configModule/

  // Begin public method /initModule/
  // Example    : battleship.battle.initModule( $('#div_id') );
  // Purpose    :
  //   Directs battle to offer its capability to the user
  // Arguments  :
  //   * $append_target (example: $('#div_id')).
  //     A jQuery collection that should represent
  //     a single DOM container
  // Action     :
  //   Appends the battle slider to the provided container and fills
  //   it with HTML content.  It then initializes elements,
  //   events, and handlers to provide the user with a battle-room
  //   interface
  // Returns    : true on success, false on failure
  // Throws     : none
  //
  initModule = function ( $append_target ) {
    var $container, $battle;
    // load battle slider html and jquery cache
    stateMap.$append_target = $append_target;
    $container = $append_target;
    $append_target.append( configMap.main_html );
    setJqueryMap();

    $battle = jqueryMap.$battle;

    // initialize battle arena by default
    battleship.arena.configModule({
      arena_width  : 10,
      arena_height : 10,
      arena_model  : battleship.model.arena,
      battle_model : battleship.model.battle,
      cell_model   : battleship.model.cell,
      plane_model  : battleship.model.plane,
      progressBar_model : battleship.model.progressBar
    });
    battleship.arena.initModule( jqueryMap.$battle );
    // Have $list_box subscribe to jQuery global events
    
    
    $.gevent.subscribe( $container, 'battleship-accept_request',   onAcceptAgonist    );
    $.gevent.subscribe( $container, 'battleship-login',            onLogin            );
    $.gevent.subscribe( $container, 'battleship-logout',           onLogout           );

    // bind user input events
  };
  // End public method /initModule/

  // Begin public method /removeSlider/
  // Purpose    :
  //   * Removes battleSlider DOM element
  //   * Reverts to initial state
  //   * Removes pointers to callbacks and other data
  // Arguments  : none
  // Returns    : true
  // Throws     : none
  //
  removeSlider = function () {
    
    return true;
  };
  // End public method /removeSlider/

  // Begin public method /handleResize/
  // Purpose    :
  //   Given a window resize event, adjust the presentation
  //   provided by this module if needed
  // Actions    :
  //   If the window height or width falls below
  //   a given threshold, resize the battle slider for the
  //   reduced window size.
  // Returns    : Boolean
  //   * false - resize not considered
  //   * true  - resize considered
  // Throws     : none
  //
  handleResize = function () {
    
    return true;
  };
  // End public method /handleResize/

  // return public methods
  return {
    configModule      : configModule,
    initModule        : initModule,
    removeSlider      : removeSlider,
    handleResize      : handleResize
  };
  //------------------- END PUBLIC METHODS ---------------------
}());
