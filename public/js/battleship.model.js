/*
 * battleship.model.js
 * Model module
*/

/*jslint         browser : true, continue : true,
  devel  : true, indent  : 2,    maxerr   : 50,
  newcap : true, nomen   : true, plusplus : true,
  regexp : true, sloppy  : true, vars     : false,
  white  : true
*/
/*global TAFFY, $, battleship */
battleship.model = (function () {
  'use strict';
  var
    configMap = { anon_id : 'a0' },
    stateMap  = {
      anon_user               : null,
      cid_serial              : 0,
      plane_id_serial         : 0,
      is_connected            : false,
      people_cid_map          : {},
      people_db               : TAFFY(),
      user                    : null,
      plane_pid_map           : {},
      plane_db                : TAFFY()
    },

    isFakeData = false,

    personProto, makeCid, clearPeopleDb, completeLogin,
    makePerson, removePerson, people, chat, 
    cellProto, cell,  planeProto,  plane, arena, battle,
    progressBar,
    initModule;

  // The people object API
  // ---------------------
  // The people object is available at battleship.model.people.
  // The people object provides methods and events to manage
  // a collection of person objects. Its public methods include:
  //   * get_user() - return the current user person object.
  //     If the current user is not signed-in, an anonymous person
  //     object is returned.
  //   * get_db() - return the TaffyDB database of all the person
  //     objects - including the current user - presorted.
  //   * get_by_cid( <client_id> ) - return a person object with
  //     provided unique id.
  //   * login( <user_name> ) - login as the user with the provided
  //     user name. The current user object is changed to reflect
  //     the new identity. Successful completion of login
  //     publishes a 'battleship-login' global custom event.
  //   * logout()- revert the current user object to anonymous.
  //     This method publishes a 'battleship-logout' global custom event.
  //
  // jQuery global custom events published by the object include:
  //   * battleship-login - This is published when a user login process
  //     completes. The updated user object is provided as data.
  //   * battleship-logout - This is published when a logout completes.
  //     The former user object is provided as data.
  //
  // Each person is represented by a person object.
  // Person objects provide the following methods:
  //   * get_is_user() - return true if object is the current user
  //   * get_is_anon() - return true if object is anonymous
  //
  // The attributes for a person object include:
  //   * cid - string client id. This is always defined, and
  //     is only different from the id attribute
  //     if the client data is not synced with the backend.
  //   * id - the unique id. This may be undefined if the
  //     object is not synced with the backend.
  //   * name - the string name of the user.
  //   * css_map - a map of attributes used for avatar
  //     presentation.
  //
  personProto = {
    get_is_user : function () {
      return this.cid === stateMap.user.cid;
    },
    get_is_anon : function () {
      return this.cid === stateMap.anon_user.cid;
    }
  };

  makeCid = function () {
    return 'c' + String( stateMap.cid_serial++ );
  };

  clearPeopleDb = function () {
    var user = stateMap.user;
    stateMap.people_db      = TAFFY();
    stateMap.people_cid_map = {};
    if ( user ) {
      stateMap.people_db.insert( user );
      stateMap.people_cid_map[ user.cid ] = user;
    }
  };

  completeLogin = function ( user_list ) {
    var user_map = user_list[ 0 ];
    delete stateMap.people_cid_map[ user_map.cid ];
    stateMap.user.cid     = user_map._id;
    stateMap.user.id      = user_map._id;
    stateMap.user.css_map = user_map.css_map;
    stateMap.people_cid_map[ user_map._id ] = stateMap.user;
    chat.join();
    $.cookie('user_name', stateMap.user.name, { expires: 7, path: '/' });
    $.gevent.publish( 'battleship-login', [ stateMap.user ] );
  };

  makePerson = function ( person_map ) {
    var person,
      cid     = person_map.cid,
      css_map = person_map.css_map,
      id      = person_map.id,
      name    = person_map.name;

    if ( cid === undefined || ! name ) {
      throw 'client id and name required';
    }

    person         = Object.create( personProto );
    person.cid     = cid;
    person.name    = name;
    person.css_map = css_map;

    if ( id ) { person.id = id; }

    stateMap.people_cid_map[ cid ] = person;

    stateMap.people_db.insert( person );
    return person;
  };

  removePerson = function ( person ) {
    if ( ! person ) { return false; }
    // cannot remove anonymous person
    if ( person.id === configMap.anon_id ) {
      return false;
    }

    stateMap.people_db({ cid : person.cid }).remove();
    if ( person.cid ) {
      delete stateMap.people_cid_map[ person.cid ];
    }
    return true;
  };

  people = (function () {
    var get_by_cid, get_db, get_user, login, logout;

    get_by_cid = function ( cid ) {
      return stateMap.people_cid_map[ cid ];
    };

    get_db = function () { return stateMap.people_db; };

    get_user = function () { return stateMap.user; };

    login = function ( name ) {
      var sio = isFakeData ? battleship.fake.mockSio : battleship.data.getSio();

      stateMap.user = makePerson({
        cid     : makeCid(),
        css_map : {top : 25, left : 25, 'background-color':'#8f8'},
        name    : name
      });

      sio.on( 'userupdate', completeLogin );

      sio.emit( 'adduser', {
        cid     : stateMap.user.cid,
        css_map : stateMap.user.css_map,
        name    : stateMap.user.name
      });
    };

    logout = function () {
      var user = stateMap.user;

      $.removeCookie('user_name');

      chat._leave();
      stateMap.user = stateMap.anon_user;
      clearPeopleDb();

      $.gevent.publish( 'battleship-logout', [ user ] );
    };

    return {
      get_by_cid : get_by_cid,
      get_db     : get_db,
      get_user   : get_user,
      login      : login,
      logout     : logout
    };
  }());

  // The chat object API
  // -------------------
  // The chat object is available at battleship.model.chat.
  // The chat object provides methods and events to manage
  // chat messaging. Its public methods include:
  //  * join() - joins the chat room. This routine sets up
  //    the chat protocol with the backend including publishers
  //    for 'battleship-listchange' and 'battleship-updatechat' global
  //    custom events. If the current user is anonymous,
  //    join() aborts and returns false.
  //  * get_chatee() - return the person object with whom the user
  //    is chatting with. If there is no chatee, null is returned.
  //  * set_chatee( <person_id> ) - set the chatee to the person
  //    identified by person_id. If the person_id does not exist
  //    in the people list, the chatee is set to null. If the
  //    person requested is already the chatee, it returns false.
  //    It publishes a 'battleship-setchatee' global custom event.
  //  * send_msg( <msg_text> ) - send a message to the chatee.
  //    It publishes a 'battleship-updatechat' global custom event.
  //    If the user is anonymous or the chatee is null, it
  //    aborts and returns false.
  //  * update_avatar( <update_avtr_map> ) - send the
  //    update_avtr_map to the backend. This results in an
  //    'battleship-listchange' event which publishes the updated
  //    people list and avatar information (the css_map in the
  //    person objects). The update_avtr_map must have the form
  //    { person_id : person_id, css_map : css_map }.
  //
  // jQuery global custom events published by the object include:
  //  * battleship-setchatee - This is published when a new chatee is
  //    set. A map of the form:
  //      { old_chatee : <old_chatee_person_object>,
  //        new_chatee : <new_chatee_person_object>
  //      }
  //    is provided as data.
  //  * battleship-listchange - This is published when the list of
  //    online people changes in length (i.e. when a person
  //    joins or leaves a chat) or when their contents change
  //    (i.e. when a person's avatar details change).
  //    A subscriber to this event should get the people_db
  //    from the people model for the updated data.
  //  * battleship-updatechat - This is published when a new message
  //    is received or sent. A map of the form:
  //      { dest_id   : <chatee_id>,
  //        dest_name : <chatee_name>,
  //        sender_id : <sender_id>,
  //        msg_text  : <message_content>
  //      }
  //    is provided as data.
  //
  chat = (function () {
    var
      _publish_listchange, _publish_updatechat,
      _update_list, _leave_chat,

      get_chatee, join_chat, send_msg,
      set_chatee, update_avatar,

      chatee = null;

    // Begin internal methods
    _update_list = function( arg_list ) {
      var i, person_map, make_person_map, person,
        people_list      = arg_list[ 0 ],
        is_chatee_online = false;

      clearPeopleDb();

      PERSON:
      for ( i = 0; i < people_list.length; i++ ) {
        person_map = people_list[ i ];

        if ( ! person_map.name ) { continue PERSON; }

        // if user defined, update css_map and skip remainder
        if ( stateMap.user && stateMap.user.id === person_map._id ) {
          stateMap.user.css_map = person_map.css_map;
          continue PERSON;
        }

        make_person_map = {
          cid     : person_map._id,
          css_map : person_map.css_map,
          id      : person_map._id,
          name    : person_map.name
        };
        person = makePerson( make_person_map );

        if ( chatee && chatee.id === make_person_map.id ) {
          is_chatee_online = true;
          chatee = person;
        }
      }

      stateMap.people_db.sort( 'name' );

      // If chatee is no longer online, we unset the chatee
      // which triggers the 'battleship-setchatee' global event
      if ( chatee && ! is_chatee_online ) { set_chatee(''); }
    };

    _publish_listchange = function ( arg_list ) {
      _update_list( arg_list );
      $.gevent.publish( 'battleship-listchange', [ arg_list ] );
    };

    _publish_updatechat = function ( arg_list ) {
      var msg_map = arg_list[ 0 ];

      if ( ! chatee ) { set_chatee( msg_map.sender_id ); }
      else if ( msg_map.sender_id !== stateMap.user.id
        && msg_map.sender_id !== chatee.id
      ) { set_chatee( msg_map.sender_id ); }

      $.gevent.publish( 'battleship-updatechat', [ msg_map ] );
    };
    // End internal methods

    _leave_chat = function () {
      var sio = isFakeData ? battleship.fake.mockSio : battleship.data.getSio();
      chatee  = null;
      stateMap.is_connected = false;
      if ( sio ) { sio.emit( 'leavechat' ); }
    };

    get_chatee = function () { return chatee; };

    join_chat  = function () {
      var sio;

      if ( stateMap.is_connected ) { return false; }

      if ( stateMap.user.get_is_anon() ) {
        console.warn( 'User must be defined before joining chat');
        return false;
      }

      sio = isFakeData ? battleship.fake.mockSio : battleship.data.getSio();
      sio.on( 'listchange', _publish_listchange );
      sio.on( 'updatechat', _publish_updatechat );
      
      sio.on( 'accept_request', battle.receive_accept_request );
      stateMap.is_connected = true;
      return true;
    };

    send_msg = function ( msg_text ) {
      var msg_map,
        sio = isFakeData ? battleship.fake.mockSio : battleship.data.getSio();

      if ( ! sio ) { return false; }
      if ( ! ( stateMap.user && chatee ) ) { return false; }

      msg_map = {
        dest_id   : chatee.id,
        dest_name : chatee.name,
        sender_id : stateMap.user.id,
        msg_text  : msg_text
      };

      // we published updatechat so we can show our outgoing messages
      _publish_updatechat( [ msg_map ] );
      sio.emit( 'updatechat', msg_map );
      return true;
    };

    set_chatee = function ( person_id ) {
      var new_chatee;
      new_chatee  = stateMap.people_cid_map[ person_id ];
      if ( new_chatee ) {
        if ( chatee && chatee.id === new_chatee.id ) {
          return false;
        }
      }
      else {
        new_chatee = null;
      }

      $.gevent.publish( 'battleship-setchatee',
        { old_chatee : chatee, new_chatee : new_chatee }
      );
      chatee = new_chatee;
      return true;
    };

    // avatar_update_map should have the form:
    // { person_id : <string>, css_map : {
    //   top : <int>, left : <int>,
    //   'background-color' : <string>
    // }};
    //
    update_avatar = function ( avatar_update_map ) {
      var sio = isFakeData ? battleship.fake.mockSio : battleship.data.getSio();
      if ( sio ) {
        sio.emit( 'updateavatar', avatar_update_map );
      }
    };

    return {
      _leave        : _leave_chat,
      get_chatee    : get_chatee,
      join          : join_chat,
      send_msg      : send_msg,
      set_chatee    : set_chatee,
      update_avatar : update_avatar
    };
  }());

  cellProto = {
    get_cell_x : function () {
      return this.cell_x;
    },
    get_cell_y : function () {
      return this.cell_y;
    },
    get_cell_type : function(){
      return this.cell_type;
    },
    set_cell_type : function(type){
      this.cell_type = type;
    },
    get_cell_plane_id : function(){
      return this.p_id;
    },
    set_cell_plane_id : function(p_id){
      this.p_id = p_id;
    }
  };

  cell = (function (){
    var create,
    TYPE_EMPTY = 0,
    TYPE_PART = 1,
    TYPE_HEAD = 2,

    TYPE_FIRED_EMPTY = 3,
    TYPE_FIRED_WOUND = 4,
    TYPE_FIRED_DESTROY = 5;

    create = function(cell_map){
      var cellObject;

      cellObject = Object.create(cellProto);
      cellObject.cell_x = cell_map.cell_x;
      cellObject.cell_y = cell_map.cell_y;
      cellObject.cell_type = cell_map.cell_type;
      cellObject.p_id = cell_map.p_id;

      return cellObject;
    };

    return {
      create : create,
      TYPE_EMPTY : TYPE_EMPTY,
      TYPE_PART : TYPE_PART,
      TYPE_HEAD : TYPE_HEAD,
      TYPE_FIRED_EMPTY : TYPE_FIRED_EMPTY,
      TYPE_FIRED_WOUND : TYPE_FIRED_WOUND,
      TYPE_FIRED_DESTROY : TYPE_FIRED_DESTROY
    };

  }());

  planeProto = {
    get_plane_id : function () {
      return this.pid;
    },
    get_plane_cell_of_head : function(){
      return this.cellOfHead;
    },
    get_plane_direction: function(){
      return this.direction;
    },
    get_plane_life_count: function(){
      return this.life_count;
    },
    get_plane_current_life_count: function(){
      return this.current_life_count;
    },
    get_plane_cells : function(){
      return this.plane_cells;
    },
    get_isAlive : function(){
      return this.isAlive;
    },
    get_plane_css_color : function(){
      return this.css_color;
    },
    crash : function(){
      this.isAlive = false;
    },
    toBeFired : function(){
      if (this.current_life_count > 1){
        this.current_life_count--;
        return true;
      }else{
        this.isAlive = false;
      }
      return false;
    },
    destroy : function(){
      this.current_life_count = 0;
      this.isAlive = false;
    }
  };

  plane = (function () {

    var create, remove, makeId, _makeCells,
    plane_id_serial = 0;

    makeId = function () {
      return 'plane_id_' + String( plane_id_serial++);
    };

    _makeCells = function(plane, direction){
      var coordX, coordY, plane_cells = [], tmpCell;

      coordX = plane.get_plane_cell_of_head().get_cell_x();
      coordY = plane.get_plane_cell_of_head().get_cell_y();
      switch (direction) {
        case "up":
          tmpCell = cell.create({ cell_x : coordX, cell_y : coordY, cell_type   : cell.TYPE_HEAD, p_id : plane.pid });
          plane_cells.push(tmpCell);

          tmpCell = cell.create({ cell_x : coordX-2, cell_y : coordY+1, cell_type   : cell.TYPE_PART, p_id : plane.get_plane_id() });
          plane_cells.push(tmpCell);
          tmpCell = cell.create({ cell_x : coordX-1, cell_y : coordY+1, cell_type   : cell.TYPE_PART, p_id : plane.get_plane_id() });
          plane_cells.push(tmpCell);
          tmpCell = cell.create({ cell_x : coordX,   cell_y : coordY+1, cell_type   : cell.TYPE_PART, p_id : plane.get_plane_id() });
          plane_cells.push(tmpCell);
          tmpCell = cell.create({ cell_x : coordX+1, cell_y : coordY+1, cell_type   : cell.TYPE_PART, p_id : plane.get_plane_id() });
          plane_cells.push(tmpCell);
          tmpCell = cell.create({ cell_x : coordX+2, cell_y : coordY+1, cell_type   : cell.TYPE_PART, p_id : plane.get_plane_id() });
          plane_cells.push(tmpCell);

          tmpCell = cell.create({ cell_x : coordX,   cell_y : coordY+2, cell_type   : cell.TYPE_PART, p_id : plane.get_plane_id() });
          plane_cells.push(tmpCell);

          tmpCell = cell.create({ cell_x : coordX-1, cell_y : coordY+3, cell_type   : cell.TYPE_PART, p_id : plane.get_plane_id() });
          plane_cells.push(tmpCell);
          tmpCell = cell.create({ cell_x : coordX,   cell_y : coordY+3, cell_type   : cell.TYPE_PART, p_id : plane.get_plane_id() });
          plane_cells.push(tmpCell);
          tmpCell = cell.create({ cell_x : coordX+1, cell_y : coordY+3, cell_type   : cell.TYPE_PART, p_id : plane.get_plane_id() });
          plane_cells.push(tmpCell);
          break; 
        case "down":
          tmpCell = cell.create({ cell_x : coordX, cell_y : coordY, cell_type   : cell.TYPE_HEAD, p_id : plane.get_plane_id() });
          plane_cells.push(tmpCell);

          tmpCell = cell.create({ cell_x : coordX-2, cell_y : coordY-1, cell_type   : cell.TYPE_PART, p_id : plane.get_plane_id() });
          plane_cells.push(tmpCell);
          tmpCell = cell.create({ cell_x : coordX-1, cell_y : coordY-1, cell_type   : cell.TYPE_PART, p_id : plane.get_plane_id() });
          plane_cells.push(tmpCell);
          tmpCell = cell.create({ cell_x : coordX,   cell_y : coordY-1, cell_type   : cell.TYPE_PART, p_id : plane.get_plane_id() });
          plane_cells.push(tmpCell);
          tmpCell = cell.create({ cell_x : coordX+1, cell_y : coordY-1, cell_type   : cell.TYPE_PART, p_id : plane.get_plane_id() });
          plane_cells.push(tmpCell);
          tmpCell = cell.create({ cell_x : coordX+2, cell_y : coordY-1, cell_type   : cell.TYPE_PART, p_id : plane.get_plane_id() });
          plane_cells.push(tmpCell);

          tmpCell = cell.create({ cell_x : coordX,   cell_y : coordY-2, cell_type   : cell.TYPE_PART, p_id : plane.get_plane_id() });
          plane_cells.push(tmpCell);

          tmpCell = cell.create({ cell_x : coordX-1, cell_y : coordY-3, cell_type   : cell.TYPE_PART, p_id : plane.get_plane_id() });
          plane_cells.push(tmpCell);
          tmpCell = cell.create({ cell_x : coordX,   cell_y : coordY-3, cell_type   : cell.TYPE_PART, p_id : plane.get_plane_id() });
          plane_cells.push(tmpCell);
          tmpCell = cell.create({ cell_x : coordX+1, cell_y : coordY-3, cell_type   : cell.TYPE_PART, p_id : plane.get_plane_id() });
          plane_cells.push(tmpCell);
          break;
        case "left":
          tmpCell = cell.create({ cell_x : coordX, cell_y : coordY, cell_type   : cell.TYPE_HEAD, p_id : plane.get_plane_id() });
          plane_cells.push(tmpCell);

          tmpCell = cell.create({ cell_x : coordX+1, cell_y : coordY-2, cell_type   : cell.TYPE_PART, p_id : plane.get_plane_id() });
          plane_cells.push(tmpCell);
          tmpCell = cell.create({ cell_x : coordX+1, cell_y : coordY-1, cell_type   : cell.TYPE_PART, p_id : plane.get_plane_id() });
          plane_cells.push(tmpCell);
          tmpCell = cell.create({ cell_x : coordX+1, cell_y : coordY,   cell_type   : cell.TYPE_PART, p_id : plane.get_plane_id() });
          plane_cells.push(tmpCell);
          tmpCell = cell.create({ cell_x : coordX+1, cell_y : coordY+1, cell_type   : cell.TYPE_PART, p_id : plane.get_plane_id() });
          plane_cells.push(tmpCell);
          tmpCell = cell.create({ cell_x : coordX+1, cell_y : coordY+2, cell_type   : cell.TYPE_PART, p_id : plane.get_plane_id() });
          plane_cells.push(tmpCell);

          tmpCell = cell.create({ cell_x : coordX+2,   cell_y : coordY, cell_type   : cell.TYPE_PART, p_id : plane.get_plane_id() });
          plane_cells.push(tmpCell);

          tmpCell = cell.create({ cell_x : coordX+3, cell_y : coordY-1, cell_type   : cell.TYPE_PART, p_id : plane.get_plane_id() });
          plane_cells.push(tmpCell);
          tmpCell = cell.create({ cell_x : coordX+3, cell_y : coordY,   cell_type   : cell.TYPE_PART, p_id : plane.get_plane_id() });
          plane_cells.push(tmpCell);
          tmpCell = cell.create({ cell_x : coordX+3, cell_y : coordY+1, cell_type   : cell.TYPE_PART, p_id : plane.get_plane_id() });
          plane_cells.push(tmpCell);
          break;
        case "right":
          tmpCell = cell.create({ cell_x : coordX, cell_y : coordY, cell_type   : cell.TYPE_HEAD, p_id : plane.get_plane_id() });
          plane_cells.push(tmpCell);

          tmpCell = cell.create({ cell_x : coordX-1, cell_y : coordY-2, cell_type   : cell.TYPE_PART, p_id : plane.get_plane_id() });
          plane_cells.push(tmpCell);
          tmpCell = cell.create({ cell_x : coordX-1, cell_y : coordY-1, cell_type   : cell.TYPE_PART, p_id : plane.get_plane_id() });
          plane_cells.push(tmpCell);
          tmpCell = cell.create({ cell_x : coordX-1, cell_y : coordY,   cell_type   : cell.TYPE_PART, p_id : plane.get_plane_id() });
          plane_cells.push(tmpCell);
          tmpCell = cell.create({ cell_x : coordX-1, cell_y : coordY+1, cell_type   : cell.TYPE_PART, p_id : plane.get_plane_id() });
          plane_cells.push(tmpCell);
          tmpCell = cell.create({ cell_x : coordX-1, cell_y : coordY+2, cell_type   : cell.TYPE_PART, p_id : plane.get_plane_id() });
          plane_cells.push(tmpCell);

          tmpCell = cell.create({ cell_x : coordX-2,   cell_y : coordY, cell_type   : cell.TYPE_PART, p_id : plane.get_plane_id() });
          plane_cells.push(tmpCell);

          tmpCell = cell.create({ cell_x : coordX-3, cell_y : coordY-1, cell_type   : cell.TYPE_PART, p_id : plane.get_plane_id() });
          plane_cells.push(tmpCell);
          tmpCell = cell.create({ cell_x : coordX-3, cell_y : coordY,   cell_type   : cell.TYPE_PART, p_id : plane.get_plane_id() });
          plane_cells.push(tmpCell);
          tmpCell = cell.create({ cell_x : coordX-3, cell_y : coordY+1, cell_type   : cell.TYPE_PART, p_id : plane.get_plane_id() });
          plane_cells.push(tmpCell);
          break;
        default: 
            throw 'direction must be /up, down, left, or right/';
      }
      return plane_cells;
    };

    remove = function ( plane ) {
      if ( ! plane ){
        return false;
      }
      else {
        console.log('delete');
      }
      return true;
    };

    create = function ( plane_map ) {
      var tmpPlane, tmpCells,
        pid         = makeId(),
        cell        = plane_map.cell,
        direction   = plane_map.direction,
        life_count  = plane_map.life_count,
        wing_length = plane_map.wing_length,
        css_color   = plane_map.css_color;


      if (!direction ) {
        throw 'direction is required';
      }

      tmpPlane                    = Object.create( planeProto );
      tmpPlane.pid                = pid;
      tmpPlane.cellOfHead         = cell;
      tmpPlane.direction          = direction;
      tmpPlane.life_count         = life_count;
      tmpPlane.current_life_count = life_count;
      tmpPlane.isAlive            = true;
      tmpPlane.css_color          = css_color;

      tmpCells = _makeCells(tmpPlane, direction);
      tmpPlane.plane_cells = tmpCells;

      return tmpPlane;
    };

    return {
      create  : create,
      remove  : remove
    };
  }());

  arena = (function(){
    var set_max_plane_number, add_plane, remove_plane, set_up_map, check_space, 
    get_number_of_planes, get_plane_by_id, get_map, get_cell_by_coord,
    toBeFired, is_ready, restart,

    MAP_WIDTH = 0, MAP_HEIGHT,

    _planes = [], _destroyed_planes = [],_map = null,

    MAX_PLANE_NUMBER;

    restart = function(){
      _planes = [];
      _destroyed_planes = [];
      set_up_map(MAP_WIDTH, MAP_HEIGHT, MAX_PLANE_NUMBER);
    };

    toBeFired = function(input_coord){
      var coordX, coordY, plane, _cell;

      coordX = input_coord.coordX;
      coordY = input_coord.coordY;
      switch (_map[coordY][coordX].get_cell_type()){
        case cell.TYPE_EMPTY :
          _map[coordY][coordX].set_cell_type(cell.TYPE_FIRED_EMPTY);
        break;
        case cell.TYPE_PART :
          _cell = _map[coordY][coordX];
          plane = get_plane_by_id(_cell.get_cell_plane_id());
          plane.toBeFired();
          //uhsen ongots ruu buudahiig tootsool
          if(!plane.get_isAlive() && _destroyed_planes.indexOf(plane) === -1){
            _destroyed_planes.push(plane);
          }
          _cell.set_cell_type(cell.TYPE_FIRED_WOUND);
        break;
        case cell.TYPE_HEAD :
          _cell = _map[coordY][coordX];
          plane = get_plane_by_id(_cell.get_cell_plane_id());
          plane.destroy();
          _destroyed_planes.push(plane);
          _map[coordY][coordX].set_cell_type(cell.TYPE_FIRED_DESTROY);
        break;
      }
      if(_destroyed_planes.length >= MAX_PLANE_NUMBER){
        $.gevent.publish('battleship-lost', []);
      }

      return _map[coordY][coordX];
      
    };

    add_plane = function(plane){
      var i, cells, x, y;

      cells = plane.get_plane_cells();
      for( i in cells ){
        x = cells[i].get_cell_x();
        y = cells[i].get_cell_y();
        _map[y][x] = cells[i];
      }
      _planes.push(plane);
    };

    set_up_map = function(width, height, max_number){
      var x, y, cell_map;

      MAX_PLANE_NUMBER = max_number;

      MAP_WIDTH = width;
      MAP_HEIGHT = height;

      _map = battleship.util.createArray(width, height);
      for( y=0; y<height; y++){
        for( x=0; x<width; x++){
          cell_map = { cell_x : x, cell_y : y, cell_type : cell.TYPE_EMPTY };
          _map[y][x] = cell.create(cell_map);
        }
      }
    };

    remove_plane = function(plane){
      var i = _planes.indexOf(plane), ci, x, y;
      if(i != -1){
        for( ci=0; ci<plane.get_plane_cells().length; ci++){
            
            x = plane.get_plane_cells()[ci].get_cell_x();
            y = plane.get_plane_cells()[ci].get_cell_y();
            _map[y][x].set_cell_type(cell.TYPE_EMPTY);
            _map[y][x].set_cell_plane_id(undefined);
        }
        _planes.splice(i, 1);
      }
    };

    check_space = function( plane ){
      var i,j,z, mCell, mCells, isAvailable = false, 
      x, y, otherPlane, otherPlanes, otherCells, otherCell;

      x = plane.get_plane_cell_of_head().get_cell_x();
      y = plane.get_plane_cell_of_head().get_cell_y();
      switch (plane.get_plane_direction()) {
        case "up":
            if((x > 1 && x < 8) && y < 7){
              isAvailable = true;           
            }
            break; 
        case "down":
            if((x > 1 && x < 8) && y > 2){
              isAvailable = true;
            }
            break;
        case "left":
          if((y > 1 && y < 8) && x < 7){
            isAvailable = true;
            }
          break;
        case "right":
          if((y > 1 && y < 8) && x > 2){
            isAvailable = true;
            }
          break;
        default: 
            throw 'direction must be up, down, left, or right';
      }

      if(isAvailable){

        mCells = plane.get_plane_cells();
        otherPlanes = _planes;

        for(i in mCells){

          mCell = mCells[i];

          for(j in otherPlanes){

            otherPlane = otherPlanes[j];
            otherCells = otherPlane.get_plane_cells();

            for(z in otherCells){

              otherCell = otherCells[z];

              if(mCell.get_cell_x() === otherCell.get_cell_x() && mCell.get_cell_y() === otherCell.get_cell_y()){
                  isAvailable = false;
                }
            }
          }
        }
      }
    
      return isAvailable;
    };

    get_number_of_planes = function(){
      return _planes.length;
    };

    get_plane_by_id = function(pid){
      var i;

      for( i=0; i<_planes.length; i++){
        if(_planes[i].get_plane_id() === pid){
          return _planes[i];
        }
      }

      return undefined;
    };

    get_map = function(){
      return _map;
    };

    get_cell_by_coord = function(coordX, coordY){
      return _map ? false : _map[coordY][coordX];
    };

    is_ready = function(){
      return _planes.length >= MAX_PLANE_NUMBER ? true : false;
    };

    return {
      set_up_map           : set_up_map,
      add_plane            : add_plane,
      remove_plane         : remove_plane,
      check_space          : check_space,
      get_number_of_planes : get_number_of_planes,
      get_plane_by_id      : get_plane_by_id,
      get_map              : get_map,
      toBeFired            : toBeFired,
      is_ready             : is_ready,
      restart              : restart
    };
  }());

  battle = (function(){
    var 
      is_playing,
      set_agonist, get_agonist, 
      send_battle_request, receive_battle_agonist,
      send_accept_request, receive_accept_request,
      send_fire, receive_fire,
      send_notify_fire, _receive_notify_fire,
      send_lost_request, _receive_lost_request,
      is_my_turn,

      agonist = null, wait_agonist = true;

      _receive_lost_request = function( arg_list ){
        wait_agonist = true;
        agonist = null;
        $.gevent.publish('battleship-win', []);
      };

      send_lost_request = function(){
        var sio, msg_map;
        sio = isFakeData ? battleship.fake.mockSio : battleship.data.getSio();

        if ( ! sio ) { return false; }
        if ( ! ( stateMap.user ) ) { return false; }
        if( ! agonist ){ return false; }

        msg_map = {
          dest_id   : agonist.id,
          sender_id : stateMap.user.id
        };

        sio.emit('lost_request', msg_map);

        wait_agonist = true;
        agonist = null;
      };

      _receive_notify_fire = function(arg_list){
        var msg_map, lAgonist;
        msg_map = arg_list[ 0 ];
        lAgonist = stateMap.people_cid_map[ msg_map.sender_id ];

        if ( lAgonist ) {
          if ( agonist && agonist.id !== lAgonist.id ) {
            return false;
          }
        }
        $.gevent.publish( 'battleship-notify_fire_request', [ msg_map ] );
      };

      send_notify_fire = function(fired_cell){
        var cell, sio, msg_map;

        sio = isFakeData ? battleship.fake.mockSio : battleship.data.getSio();

        if ( ! sio ) { return false; }
        if ( ! ( stateMap.user ) ) { return false; }
        if( ! agonist ){ return false; }

        msg_map = {
          dest_id   : agonist.id,
          sender_id : stateMap.user.id,
          coordX : fired_cell.get_cell_x(),
          coordY : fired_cell.get_cell_y(),
          cell_type : fired_cell.get_cell_type()
        };
        
        sio.emit('notify_fire_request', msg_map);
      };

      receive_fire = function(arg_list){
        var msg_map, fired_agonist, cell;
        msg_map = arg_list[ 0 ];
        fired_agonist = stateMap.people_cid_map[ msg_map.sender_id ];

        if ( fired_agonist ) {
          if ( agonist && agonist.id !== fired_agonist.id ) {
            return false;
          }
        }
        cell = arena.toBeFired(msg_map);
        send_notify_fire(cell);
        $.gevent.publish( 'battleship-fire_request', [  ] );
        wait_agonist = false;        
      };

      send_fire = function(input_map){
        if(wait_agonist){
          return false;
        }

        var coordX, coordY, sio, msg_map;

        coordX = input_map.coordX;
        coordY = input_map.coordY;

        sio = isFakeData ? battleship.fake.mockSio : battleship.data.getSio();

        if ( ! sio ) { return false; }
        if ( ! ( stateMap.user ) ) { return false; }
        if( ! agonist ){ return false; }

        msg_map = {
          dest_id   : agonist.id,
          sender_id : stateMap.user.id,
          coordX : coordX,
          coordY : coordY
        };
        wait_agonist = true;
        sio.emit('fire_request', msg_map);
      };

      receive_accept_request = function(arg_list){
        var msg_map, new_agonist, sio;
        msg_map = arg_list[ 0 ];
        new_agonist = stateMap.people_cid_map[ msg_map.sender_id ];

        sio = isFakeData ? battleship.fake.mockSio : battleship.data.getSio();

        if ( ! sio ) { return false; }

        if ( new_agonist ) {
          if ( agonist && agonist.id === new_agonist.id ) {
            return false;
          }
        }
        else {
          agonist = null;
        }
        if(msg_map.accepted === true){
          agonist = new_agonist;
        }
        sio.on('fire_request', receive_fire);
        $.gevent.publish( 'battleship-accept_request', [ msg_map ] );
      };

      send_accept_request = function(acc_req_map){
        var accepted_agonist, sio, msg_map;
        accepted_agonist = stateMap.people_cid_map[ acc_req_map.accepted_agonist_id ];

        sio = isFakeData ? battleship.fake.mockSio : battleship.data.getSio();

        if ( ! sio ) { return false; }
        if ( ! ( stateMap.user ) ) { return false; }

        msg_map = {
          dest_id     : accepted_agonist.id,
          dest_name   : accepted_agonist.name,
          sender_name : stateMap.user.name,
          sender_id   : stateMap.user.id,
          accepted    : acc_req_map.accepted
        };
        agonist = accepted_agonist;
        sio.on('fire_request', receive_fire);
        sio.emit('accept_request', msg_map);
      };

      receive_battle_agonist = function(arg_list){
        var sio, msg_map, new_agonist;

        sio = isFakeData ? battleship.fake.mockSio : battleship.data.getSio();

        if ( ! sio ) { return false; }

        msg_map = arg_list[ 0 ];
        new_agonist = stateMap.people_cid_map[ msg_map.sender_id ];

        if ( new_agonist ) {
          if ( agonist && agonist.id === new_agonist.id ) {
            return false;
          }
        }

        agonist = new_agonist;
        if(msg_map.player_order === 1){
          wait_agonist = false;
        }else if(msg_map.player_order === 2){
          wait_agonist = true;
        }

        sio.on('lost_request', _receive_lost_request);
        sio.on('notify_fire_request', _receive_notify_fire);
        sio.on('fire_request', receive_fire);
        $.gevent.publish( 'battleship-request_agonist', [ msg_map ] );
      };

      send_battle_request = function(){
        var sio, msg_map;

        sio = isFakeData ? battleship.fake.mockSio : battleship.data.getSio();

        if ( ! sio ) { return false; }
        if ( ! ( stateMap.user ) ) { return false; }
        if( agonist ){ return false; }

        msg_map = {
          sender_id : stateMap.user.id,
          sender_name : stateMap.user.name,
          player_order : 0,
          msg_text  : "If you can, defeat me!"
        };
        sio.on( 'request_agonist', receive_battle_agonist );
        sio.emit('request_agonist', msg_map); 
      };

      is_playing = function(){
        return agonist !== null ? true : false;
      };

      is_my_turn = function(){
        return !wait_agonist;
      };

      return {
        send_battle_request    : send_battle_request,
        receive_battle_agonist : receive_battle_agonist,
        send_accept_request    : send_accept_request,
        receive_accept_request : receive_accept_request,
        send_fire              : send_fire,
        receive_fire           : receive_fire,
        is_playing             : is_playing,
        send_notify_fire       : send_notify_fire,
        send_lost_request      : send_lost_request,
        is_my_turn             : is_my_turn
      };
  }());

  progressBar = (function(){
    var init, create, begin, stop, restart, pause,

    TIME_DURATION, END_COLOR, START_COLOR, WIDTH;


    init = function(input_map){
      TIME_DURATION = input_map.time_duration || 60 * 1000;
      END_COLOR = input_map.end_color || "red";
      START_COLOR = input_map.start_color || "green";
      WIDTH = input_map.pb_width || "331px";
    };

    begin = function($progressBar){
      $progressBar.animate({
        width : "0px",
        backgroundColor : END_COLOR
      }, TIME_DURATION);
    };

    restart = function($progressBar){
      $progressBar.stop();
      $progressBar.width(WIDTH);
    };

    return {
      init : init,
      begin : begin,
      restart : restart
    };
  }());

  initModule = function () {
    // initialize anonymous person
    stateMap.anon_user = makePerson({
      cid   : configMap.anon_id,
      id    : configMap.anon_id,
      name  : 'anonymous'
    });
    stateMap.user = stateMap.anon_user;
  };

  return {
    initModule : initModule,
    chat       : chat,
    people     : people,
    cell       : cell,
    plane      : plane,
    arena      : arena,
    battle     : battle,
    progressBar : progressBar
  };
}());
