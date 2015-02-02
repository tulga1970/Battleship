/*
 * battleship.arena.js
 * arena feature module for battleship
*/

/*jslint         browser : true, continue : true,
  devel  : true, indent  : 2,    maxerr   : 50,
  newcap : true, nomen   : true, plusplus : true,
  regexp : true, sloppy  : true, vars     : false,
  white  : true
*/

/*global $, battleship */

battleship.arena = (function () {
  'use strict';
  //---------------- BEGIN MODULE SCOPE VARIABLES --------------
  var
    configMap = {
      main_html : String()
        +'<div href="" class="battleship-btn-start-quick-play">quick play</div>'
        +'<br class="clear br-2">'
      	+'<ul class="battleship-battle-planelist">'
      		+'<li ><img src="../imgs/plane-up.png" direction="up"/></li>'
      		+'<li ><img src="../imgs/plane-right.png" direction="right"/></li>'
      		+'<li ><img src="../imgs/plane-down.png" direction="down"/></li>'
      		+'<li ><img src="../imgs/plane-left.png" direction="left"/></li>'
      	+'</ul>'
        +'<div class="battleship-battle-arena-cont">'
          +'<div id="my-arena" class="battleship-battle-arena"></div>'
          +'<div id="my-timer-bar" class="battleship-timer-bar"></div>'
        +'</div>'
        +'<div class="battleship-battle-arena-cont">'
          +'<div id="enemy-arena" class="battleship-battle-arena"></div>'
          +'<div id="enemy-timer-bar" class="battleship-timer-bar"></div>'
        +'</div>',

      settable_map : {
      	arena_width  : true,
      	arena_height : true,
        arena_model  : true,
        battle_model : true,
        cell_model   : true,
        plane_model  : true,
        progressBar_model : true
      },

      arena_width       : 0,
      arena_height      : 0,
      max_plane_number  : 3,
      arena_model       : null,
      battle_model      : null,
      cell_model        : null,
      plane_model       : null,
      progressBar_model : null,

      arena_characters  : ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"],

      my_prefix         : "my-arena",
      enemy_prefix      : "enemy-arena",
    },
    stateMap  = {
      $container    	: null,
      my_arena          : [[]],
      enemy_arena       : [[]],
      $my_map			: [[]],
      $enemy_map		: [[]],
      planes			: [],
      current_direction : ""
    },
    jqueryMap = {},

    isFake = false,

    setJqueryMap,  createArena, renderOnCreate, resetEnemyMap,
    configModule,  initModule, addPlane,
    removeArena,  handleResize, onLogin, onLogout, onReceiveAgonist,
    onTapMyCell, onHeldStartMyCell, onTapPlaneListItem, onTapEnemyCell, 
    onTapBtnStartQuickPlay,
    onFire, onNotifyFireRequest, onLost, onWin;
  //----------------- END MODULE SCOPE VARIABLES ---------------

  //------------------- BEGIN UTILITY METHODS ------------------
  //-------------------- END UTILITY METHODS -------------------

  //--------------------- BEGIN DOM METHODS --------------------
  // Begin DOM method /setJqueryMap/
  setJqueryMap = function () {
    jqueryMap = {
      $my_container    	    : stateMap.$container.find('#'+configMap.my_prefix),
      $enemy_container      : stateMap.$container.find('#'+configMap.enemy_prefix),
      $my_timer             : stateMap.$container.find('#my-timer-bar'),
      $enemy_timer          : stateMap.$container.find('#enemy-timer-bar'),
      $planes_list		      : stateMap.$container.find('.battleship-battle-planelist'),
      $btn_start_quick_play : stateMap.$container.find('.battleship-btn-start-quick-play'),
      $window   		        : $(window)
    };
  };
  // End DOM method /setJqueryMap/

  //Begin DOM method /createArena/
  createArena = function( prefix ){
    var html = String(), aprefix, $cont,
    	awidth, aheight, i, j, cell_map;

    if(prefix === configMap.my_prefix){
    	$cont = jqueryMap.$my_container;
    	aprefix = configMap.my_prefix;
    }else if(prefix === configMap.enemy_prefix){
    	$cont = jqueryMap.$enemy_container;
    	aprefix = configMap.enemy_prefix;
    }else{
    	return false;
    }

    awidth = configMap.arena_width;
    aheight = configMap.arena_height;    
    
    html += '<table class="battleship-battle-arena-table">'
            + '<tbody>';

    for( i=0; i<awidth+1; i++){
     	html += '<tr>';
     	for( j=0; j<aheight+1; j++){
	   		if(i === 0 && j === 0){
	        	html += '<td></td>';
	       	}else if(j === 0 && i > 0){
	          	html += '<td>' + configMap.arena_characters[i-1] + '</td>';
	        }else if(i === 0 && j > 0){
	          	html += '<td>' + j + '</td>'; 
	        }else{
	          	html += '<td cord-row="'+ (i-1) +'" cord-col="'+ (j-1)+'"></td>';
	        }
	    }
      	html += '</tr>';
    }

    html += '</tbody>'
          + '</table>';

    $cont.html(html);

    if(aprefix === configMap.my_prefix){
    	$("#"+aprefix+" .battleship-battle-arena-table td").each(function() {
		    
		    j = parseInt($(this).attr( 'cord-col' ));
	    	i = parseInt($(this).attr( 'cord-row' ));

		    if(!isNaN(i) && !isNaN(j)){

		    	$(this).bind('utap', onTapMyCell);
		    	$(this).bind( 'uheldstart', onHeldStartMyCell );

		    	stateMap.$my_map[i][j] = $(this);
		    }
		  });
    }
    if(aprefix === configMap.enemy_prefix){
      $("#"+aprefix+" .battleship-battle-arena-table td").each(function() {
        
        j = parseInt($(this).attr( 'cord-col' ));
        i = parseInt($(this).attr( 'cord-row' ));

        if(!isNaN(i) && !isNaN(j)){

          $(this).bind('utap', onTapEnemyCell);

          stateMap.$enemy_map[i][j] = $(this);
          
        }
      });
    }        
  };
  // End DOM method /createArena/

  //Begin DOM method /renderOnCreate/
  renderOnCreate = function() {
  	var $atable, awidth, aheight, row, col, map, html, cell, plane;
    
    //$atable = jqueryMap.$my_container.find('.battleship-battle-arena-table');
    map = configMap.arena_model.get_map();

    awidth = configMap.arena_width;
    aheight = configMap.arena_height;

  	for( row=0; row<aheight; row++){
  		for( col=0; col<awidth; col++){
  			if(map[row][col].get_cell_type() !== battleship.model.cell.TYPE_EMPTY){
  				cell = map[row][col];
  				plane = configMap.arena_model.get_plane_by_id(cell.get_cell_plane_id());
  				html = '<div class="plane-cell" plane-id="'+plane.get_plane_id()+'" style="background-color : '+plane.get_plane_css_color()+';"></div>';
  				stateMap.$my_map[row][col].html(html);
  			}else {
  				stateMap.$my_map[row][col].empty();
  			}
  		}
  	}
  }
  //End DOM method /renderOnCreate/

  //Begin DOM method /resetEnemyMap/
  resetEnemyMap = function() {
    var i,j;

    $("#"+configMap.enemy_prefix+" .battleship-battle-arena-table td").each(function() {
        
      j = parseInt($(this).attr( 'cord-col' ));
      i = parseInt($(this).attr( 'cord-row' ));

      if(!isNaN(i) && !isNaN(j)){

        $(this).text("");
      }
    });
  }
  //End DOM method /resetEnemyMap/

  //---------------------- END DOM METHODS ---------------------

  //------------------- BEGIN EVENT HANDLERS -------------------
  onLogin = function ( event, login_user ) {
    var fakePlanes = [], i, plane, my_map;

    createArena(configMap.my_prefix);
    createArena(configMap.enemy_prefix);

    my_map = configMap.arena_model.get_map();

    if(isFake){
      fakePlanes = [{
        cell : my_map[0][2],
        direction : "up",
        life_count : 3,
        css_color  : battleship.util_b.getRandRgb()
      },{
        cell : my_map[4][2],
        direction : "up",
        life_count : 3,
        css_color  : battleship.util_b.getRandRgb()
      },{
        cell : my_map[1][5],
        direction : "up",
        life_count : 3,
        css_color  : battleship.util_b.getRandRgb()
      }];
      for(i in fakePlanes){
        plane = configMap.plane_model.create(fakePlanes[i]);
        if(configMap.arena_model.check_space(plane)){
          configMap.arena_model.add_plane(plane);
        }
      }
    }
    renderOnCreate();
  };

  onLogout = function ( event, logout_user ) {
    removeArena();
  };

  onReceiveAgonist = function ( event, arg_map ) {
    var conf, prgoressBar_input_map;
    jqueryMap.$my_timer.show();
    jqueryMap.$enemy_timer.show();

    prgoressBar_input_map = {
      time_duration : 60 * 1000,
      end_color : "red",
      start_color : "green",
      width : "331px"
    };

    configMap.progressBar_model.init(prgoressBar_input_map);

    if(configMap.battle_model.is_my_turn()){
      configMap.progressBar_model.begin(jqueryMap.$my_timer);
    }else{
      configMap.progressBar_model.begin(jqueryMap.$enemy_timer);
    }
    conf = alert("Opponent found: "+arg_map.sender_name);
  };

  onTapMyCell = function (event){

    if( configMap.battle_model.is_playing()) return false;

  	var $tapped  = $( event.elem_target ), colNum, rowNum, 
  	coordX, coordY, direction, plane_input_map, plane, my_map, cell;

  	direction = stateMap.current_direction;

  	if(direction === "" && $tapped.prop("nodeName") !== 'TD') return false;
  	
    colNum = $tapped.attr( 'cord-col' );
    rowNum = $tapped.attr( 'cord-row' );

    coordX = parseInt(colNum);
    coordY = parseInt(rowNum);

    my_map = configMap.arena_model.get_map();

    if(configMap.arena_model.get_number_of_planes() < configMap.max_plane_number){
    	plane_input_map = {
	    	cell : my_map[coordY][coordX],
	    	direction : direction,
	    	life_count : 3,
	    	css_color  : battleship.util_b.getRandRgb()
	    };

	    plane = configMap.plane_model.create(plane_input_map);
	    if(configMap.arena_model.check_space(plane)){
	    	configMap.arena_model.add_plane(plane);
	    }
    }
    renderOnCreate();
    return false;
  };

  onTapEnemyCell = function (event){
    var $tapped  = $( event.elem_target ), colNum, rowNum, 
    coordX, coordY, fire_input_map;
    if($tapped.prop("nodeName") !== 'TD') return false;
    
    colNum = $tapped.attr( 'cord-col' );
    rowNum = $tapped.attr( 'cord-row' );

    coordX = parseInt(colNum);
    coordY = parseInt(rowNum);

    fire_input_map = {
      coordX : coordX,
      coordY : coordY
    };

    if(configMap.battle_model.is_my_turn()){
      configMap.progressBar_model.begin(jqueryMap.$enemy_timer);
      configMap.progressBar_model.restart(jqueryMap.$my_timer);
    }    

    configMap.battle_model.send_fire(fire_input_map);
    
    return false;
  };

  onTapPlaneListItem = function (event){
  	var $tapped  = $( event.elem_target );

  	jqueryMap.$planes_list.find('li img').each(function(){
  		$(this).removeClass('selected');
  	});

  	$tapped.addClass('selected');

    stateMap.current_direction = $tapped.attr( 'direction' );
    return false;
  };

  onHeldStartMyCell = function ( event ){

    if( configMap.battle_model.is_playing()) return false;

    var $tapped  = $( event.elem_target ), plane_id, plane;
  	if($tapped.prop("nodeName") !== 'DIV') return false;
	
	plane_id = $tapped.attr( 'plane-id' );
	plane = configMap.arena_model.get_plane_by_id(plane_id)
    if(plane !== undefined){
    	configMap.arena_model.remove_plane(plane);
    	renderOnCreate(configMap.my_prefix);
    	return false;
    }
  };

  //onTapBtnStartQuickPlay event handler
  //Summary : Checks if user sets all plane in arena then send request
  // 
  onTapBtnStartQuickPlay = function(event){
    if(configMap.arena_model.is_ready()){
      if(! configMap.battle_model.is_playing()){
        configMap.battle_model.send_battle_request();
      }else{
        console.log('you are playing');
      }      
    }
    else{
      console.log('Please place your planes.');
    }
    return false;
  };

  //Begin GLOBAL EVENT handler /onFire/
  onFire = function( event, arg_map ) {
    var awidth, aheight, row, col, map, html, plane;

    map = configMap.arena_model.get_map();

    awidth = configMap.arena_width;
    aheight = configMap.arena_height;

    for( row=0; row<aheight; row++){
      for( col=0; col<awidth; col++){
        switch (map[row][col].get_cell_type()){
          case configMap.cell_model.TYPE_FIRED_EMPTY :
            stateMap.$my_map[row][col].text('e');
          break;
          case configMap.cell_model.TYPE_FIRED_WOUND :
            stateMap.$my_map[row][col].find('.plane-cell').text('w');
          break;
          case configMap.cell_model.TYPE_FIRED_DESTROY :
            stateMap.$my_map[row][col].find('.plane-cell').text('d');
          break;
        }
      }
    }

    configMap.progressBar_model.begin(jqueryMap.$my_timer);
    configMap.progressBar_model.restart(jqueryMap.$enemy_timer);
  };
  //End DOM method /onFire/

  //Begin GLOBAL EVENT handler /onNotifyFireRequest/
  onNotifyFireRequest = function( event, arg_map ) {
    var coordX, coordY, cell_type;

    coordX = arg_map.coordX;
    coordY = arg_map.coordY;
    cell_type = arg_map.cell_type;

    switch (cell_type){
      case configMap.cell_model.TYPE_FIRED_EMPTY :
        stateMap.$enemy_map[coordY][coordX].text('e');
      break;
      case configMap.cell_model.TYPE_FIRED_WOUND :
        stateMap.$enemy_map[coordY][coordX].text('w');
      break;
      case configMap.cell_model.TYPE_FIRED_DESTROY :
        stateMap.$enemy_map[coordY][coordX].text('d');
      break;
    }
  };
  //End DOM method /onNotifyFireRequest/

  //Begin GLOBAL EVENT handler /onLost/
  onLost = function( event, arg_map ) {
    configMap.battle_model.send_lost_request();

    configMap.arena_model.restart();
    stateMap.my_arena = configMap.arena_model.map;

    renderOnCreate();
    resetEnemyMap();

    configMap.progressBar_model.restart(jqueryMap.$my_timer);
    configMap.progressBar_model.restart(jqueryMap.$enemy_timer);

    jqueryMap.$my_timer.hide();
    jqueryMap.$enemy_timer.hide();
    alert('You LOST');
  };
  //End DOM method /onLost/

  //Begin GLOBAL EVENT handler /onLost/
  onWin = function( event, arg_map ) {
    jqueryMap.$my_timer.hide();
    jqueryMap.$enemy_timer.hide();

    configMap.arena_model.restart();
    stateMap.my_arena = configMap.arena_model.map;

    configMap.progressBar_model.restart(jqueryMap.$my_timer);
    configMap.progressBar_model.restart(jqueryMap.$enemy_timer);

    renderOnCreate();
    resetEnemyMap();

    alert('You WIN');
  };
  //End DOM method /onLost/

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
  	var $container;
    // load battle slider html and jquery cache
    stateMap.$container = $append_target;
    $container = $append_target;
    $append_target.html(configMap.main_html);
    setJqueryMap();

    //Initialize arena maps /my and enemy/
    //stateMap.my_arena = battleship.util.createArrayWithDefault(configMap.arena_width, configMap.arena_height, 0);
    configMap.arena_model.set_up_map(configMap.arena_width, configMap.arena_height, configMap.max_plane_number);
    stateMap.my_arena = configMap.arena_model.map;
    //stateMap.enemy_arena = battleship.util.createArrayWithDefault(configMap.arena_width, configMap.arena_height, 0);

    stateMap.$my_map = battleship.util.createArray(configMap.arena_width, configMap.arena_height);
    stateMap.$enemy_map = battleship.util.createArray(configMap.arena_width, configMap.arena_height);

    // Have $list_box subscribe to jQuery global events
    
    $.gevent.subscribe( $container, 'battleship-request_agonist',      onReceiveAgonist     );
    $.gevent.subscribe( $container, 'battleship-fire_request',         onFire               );
    $.gevent.subscribe( $container, 'battleship-notify_fire_request',  onNotifyFireRequest  );
    $.gevent.subscribe( $container, 'battleship-lost',                 onLost               );
    $.gevent.subscribe( $container, 'battleship-win',                  onWin                );
    $.gevent.subscribe( $container, 'battleship-login',  		           onLogin              );
    $.gevent.subscribe( $container, 'battleship-logout',               onLogout             );


    // bind user input events
    jqueryMap.$planes_list.bind('utap', onTapPlaneListItem);
    jqueryMap.$btn_start_quick_play.bind('utap', onTapBtnStartQuickPlay);
  };
  // End public method /initModule/

  // Begin public method /removeArena/
  // Purpose    :
  //   * Removes battleSlider DOM element
  //   * Reverts to initial state
  //   * Removes pointers to callbacks and other data
  // Arguments  : none
  // Returns    : true
  // Throws     : none
  //
  removeArena = function () {
    stateMap.$container.find('.battleship-battle-arena-table').remove();
    return true;
  };
  // End public method /removeArena/

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
    configModule    : configModule,
    initModule      : initModule,
    removeArena     : removeArena,
    handleResize    : handleResize
  };
  //------------------- END PUBLIC METHODS ---------------------
}());
