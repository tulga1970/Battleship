/*
 * battleship.chat.js
 * Chat feature module for battleship
*/

/*jslint         browser : true, continue : true,
  devel  : true, indent  : 2,    maxerr   : 50,
  newcap : true, nomen   : true, plusplus : true,
  regexp : true, sloppy  : true, vars     : false,
  white  : truef
*/

/*global $, battleship */

battleship.chat = (function () {
  'use strict';
  //---------------- BEGIN MODULE SCOPE VARIABLES --------------
  var
    configMap = {
      main_html : String()
        + '<div class="battleship-chat">'
          + '<div class="battleship-chat-head">'
            + '<div class="battleship-chat-head-toggle">+</div>'
            + '<div class="battleship-chat-head-title">'
              + 'Chat'
            + '</div>'
          + '</div>'
          + '<div class="battleship-chat-closer">x</div>'
          + '<div class="battleship-chat-sizer">'
            + '<div class="battleship-chat-list">'
              + '<div class="battleship-chat-list-box"></div>'
            + '</div>'
            + '<div class="battleship-chat-msg">'
              + '<div class="battleship-chat-msg-log"></div>'
              + '<div class="battleship-chat-msg-in">'
                + '<form class="battleship-chat-msg-form">'
                  + '<input type="text"/>'
                  + '<input type="submit" style="display:none"/>'
                  + '<div class="battleship-chat-msg-send">'
                    + 'send'
                  + '</div>'
                + '</form>'
              + '</div>'
            + '</div>'
          + '</div>'
        + '</div>',

      settable_map : {
        slider_open_time    : true,
        slider_close_time   : true,
        slider_opened_em    : true,
        slider_closed_em    : true,
        slider_opened_title : true,
        slider_closed_title : true,

        chat_model      : true,
        people_model    : true,
        set_chat_anchor : true,
        battle_model    : true
      },

      slider_open_time     : 250,
      slider_close_time    : 250,
      slider_opened_em     : 18,
      slider_closed_em     : 2,
      slider_opened_title  : 'Tap to close',
      slider_closed_title  : 'Tap to open',
      slider_opened_min_em : 10,
      window_height_min_em : 20,

      chat_model      : null,
      people_model    : null,
      set_chat_anchor : null,
      battle_model    : null
    },
    stateMap  = {
      $append_target   : null,
      position_type    : 'closed',
      px_per_em        : 0,
      slider_hidden_px : 0,
      slider_closed_px : 0,
      slider_opened_px : 0
    },
    jqueryMap = {},

    setJqueryMap,  setPxSizes,   scrollChat,
    writeChat,     writeAlert,   clearChat,
    setSliderPosition,
    onTapToggle,   onSubmitMsg,  onTapList,
    onSetchatee,   onUpdatechat, onListchange,
    onLogin,       onLogout,
    configModule,  initModule,
    removeSlider,  handleResize;
  //----------------- END MODULE SCOPE VARIABLES ---------------

  //------------------- BEGIN UTILITY METHODS ------------------
  //-------------------- END UTILITY METHODS -------------------

  //--------------------- BEGIN DOM METHODS --------------------
  // Begin DOM method /setJqueryMap/
  setJqueryMap = function () {
    var
      $append_target = stateMap.$append_target,
      $slider        = $append_target.find( '.battleship-chat' );

    jqueryMap = {
      $slider   : $slider,
      $head     : $slider.find( '.battleship-chat-head' ),
      $toggle   : $slider.find( '.battleship-chat-head-toggle' ),
      $title    : $slider.find( '.battleship-chat-head-title' ),
      $sizer    : $slider.find( '.battleship-chat-sizer' ),
      $list_box : $slider.find( '.battleship-chat-list-box' ),
      $msg_log  : $slider.find( '.battleship-chat-msg-log' ),
      $msg_in   : $slider.find( '.battleship-chat-msg-in' ),
      $input    : $slider.find( '.battleship-chat-msg-in input[type=text]'),
      $send     : $slider.find( '.battleship-chat-msg-send' ),
      $form     : $slider.find( '.battleship-chat-msg-form' ),
      $window   : $(window)
    };
  };
  // End DOM method /setJqueryMap/

  // Begin DOM method /setPxSizes/
  setPxSizes = function () {
    var px_per_em, window_height_em, opened_height_em;

    px_per_em = battleship.util_b.getEmSize( jqueryMap.$slider.get(0) );
    window_height_em = Math.floor(
      ( jqueryMap.$window.height() / px_per_em ) + 0.5
    );

    opened_height_em
      = window_height_em > configMap.window_height_min_em
      ? configMap.slider_opened_em
      : configMap.slider_opened_min_em;

    stateMap.px_per_em        = px_per_em;
    stateMap.slider_closed_px = configMap.slider_closed_em * px_per_em;
    stateMap.slider_opened_px = opened_height_em * px_per_em;
    jqueryMap.$sizer.css({
      height : ( opened_height_em - 2 ) * px_per_em
    });
  };
  // End DOM method /setPxSizes/

  // Begin public method /setSliderPosition/
  // Example   : battleship.chat.setSliderPosition( 'closed' );
  // Purpose   : Move the chat slider to the requested position
  // Arguments :
  //   * position_type - enum('closed', 'opened', or 'hidden')
  //   * callback - optional callback to be run end at the end
  //     of slider animation.  The callback receives a jQuery
  //     collection representing the slider div as its single
  //     argument
  // Action    :
  //   This method moves the slider into the requested position.
  //   If the requested position is the current position, it
  //   returns true without taking further action
  // Returns   :
  //   * true  - The requested position was achieved
  //   * false - The requested position was not achieved
  // Throws    : none
  //
  setSliderPosition = function ( position_type, callback ) {
    var
      height_px, animate_time, slider_title, toggle_text;

    // position type of 'opened' is not allowed for anon user;
    // therefore we simply return false; the shell will fix the
    // uri and try again.
    if ( position_type === 'opened'
      && configMap.people_model.get_user().get_is_anon()
    ){ return false; }

    // return true if slider already in requested position
    if ( stateMap.position_type === position_type ){
      if ( position_type === 'opened' ) {
        jqueryMap.$input.focus();
      }
      return true;
    }

    // prepare animate parameters
    switch ( position_type ){
      case 'opened' :
        height_px    = stateMap.slider_opened_px;
        animate_time = configMap.slider_open_time;
        slider_title = configMap.slider_opened_title;
        toggle_text  = '=';
        jqueryMap.$input.focus();
      break;

      case 'hidden' :
        height_px    = 0;
        animate_time = configMap.slider_open_time;
        slider_title = '';
        toggle_text  = '+';
      break;

      case 'closed' :
        height_px    = stateMap.slider_closed_px;
        animate_time = configMap.slider_close_time;
        slider_title = configMap.slider_closed_title;
        toggle_text  = '+';
      break;

      // bail for unknown position_type
      default : return false;
    }

    // animate slider position change
    stateMap.position_type = '';
    jqueryMap.$slider.animate(
      { height : height_px },
      animate_time,
      function () {
        jqueryMap.$toggle.prop( 'title', slider_title );
        jqueryMap.$toggle.text( toggle_text );
        stateMap.position_type = position_type;
        if ( callback ) { callback( jqueryMap.$slider ); }
      }
    );
    return true;
  };
  // End public DOM method /setSliderPosition/

  // Begin private DOM methods to manage chat message
  scrollChat = function() {
    var $msg_log = jqueryMap.$msg_log;
    $msg_log.animate(
      { scrollTop : $msg_log.prop( 'scrollHeight' )
        - $msg_log.height()
      },
      150
    );
  };

  writeChat = function ( person_name, text, is_user ) {
    var msg_class = is_user
      ? 'battleship-chat-msg-log-me' : 'battleship-chat-msg-log-msg';

    jqueryMap.$msg_log.append(
      '<div class="' + msg_class + '">'
      + battleship.util_b.encodeHtml(person_name) + ': '
      + battleship.util_b.encodeHtml(text) + '</div>'
    );

    scrollChat();
  };

  writeAlert = function ( alert_text ) {
    jqueryMap.$msg_log.append(
      '<div class="battleship-chat-msg-log-alert">'
        + battleship.util_b.encodeHtml(alert_text)
      + '</div>'
    );
    scrollChat();
  };

  clearChat = function () { jqueryMap.$msg_log.empty(); };
  // End private DOM methods to manage chat message
  //---------------------- END DOM METHODS ---------------------

  //------------------- BEGIN EVENT HANDLERS -------------------
  onTapToggle = function ( event ) {
    var set_chat_anchor = configMap.set_chat_anchor;
    if ( stateMap.position_type === 'opened' ) {
      set_chat_anchor( 'closed' );
    }
    else if ( stateMap.position_type === 'closed' ){
      set_chat_anchor( 'opened' );
    }
    return false;
  };

  onSubmitMsg = function ( event ) {
    var msg_text = jqueryMap.$input.val();
    if ( msg_text.trim() === '' ) { return false; }
    configMap.chat_model.send_msg( msg_text );
    jqueryMap.$input.focus();
    jqueryMap.$send.addClass( 'battleship-x-select' );
    setTimeout(
      function () { jqueryMap.$send.removeClass( 'battleship-x-select' ); },
      250
    );
    return false;
  };

  onTapList = function ( event ) {
    var $tapped  = $( event.elem_target ), chatee_id;
    if ( ! $tapped.hasClass('battleship-chat-list-name') ) { return false; }

    chatee_id = $tapped.attr( 'data-id' );
    if ( ! chatee_id ) { return false; }

    configMap.chat_model.set_chatee( chatee_id );
    return false;
  };

  onSetchatee = function ( event, arg_map ) {
    var
      new_chatee = arg_map.new_chatee,
      old_chatee = arg_map.old_chatee;

    jqueryMap.$input.focus();
    if ( ! new_chatee ) {
      if ( old_chatee ) {
        writeAlert( old_chatee.name + ' has left the chat' );
      }
      else {
        writeAlert( 'Your friend has left the chat' );
      }
      jqueryMap.$title.text( 'Chat' );
      return false;
    }

    jqueryMap.$list_box
      .find( '.battleship-chat-list-name' )
      .removeClass( 'battleship-x-select' )
      .end()
      .find( '[data-id=' + arg_map.new_chatee.id + ']' )
      .addClass( 'battleship-x-select' );

    writeAlert( 'Now chatting with ' + arg_map.new_chatee.name );
    jqueryMap.$title.text( 'Chat with ' + arg_map.new_chatee.name );
    return true;
  };

  onListchange = function ( event ) {
    var
      list_html = String(),
      people_db = configMap.people_model.get_db(),
      chatee    = configMap.chat_model.get_chatee();


    people_db().each( function ( person, idx ) {
      var select_class = '';

      if ( person.get_is_anon() || person.get_is_user()
      ) { return true;}

      if ( chatee && chatee.id === person.id ) {
        select_class=' battleship-x-select';
      }
      list_html
        += '<div class="battleship-chat-list-name'
        +  select_class + '" data-id="' + person.id + '">'
        +  battleship.util_b.encodeHtml( person.name ) + '</div>';
    });

    if ( ! list_html ) {
      list_html = String()
        + '<div class="battleship-chat-list-note">'
        + 'To chat alone is the fate of all great souls...<br><br>'
        + 'No one is online'
        + '</div>';
      clearChat();
    }
    // jqueryMap.$list_box.html( list_html );
    jqueryMap.$list_box.html( list_html );
  };

  onUpdatechat = function ( event, msg_map ) {
    var
      is_user,
      sender_id = msg_map.sender_id,
      msg_text  = msg_map.msg_text,
      chatee    = configMap.chat_model.get_chatee() || {},
      sender    = configMap.people_model.get_by_cid( sender_id );

    if ( ! sender ) {
      writeAlert( msg_text );
      return false;
    }

    is_user = sender.get_is_user();

    if ( ! ( is_user || sender_id === chatee.id ) ) {
      configMap.chat_model.set_chatee( sender_id );
    }

    writeChat( sender.name, msg_text, is_user );

    if ( is_user ) {
      jqueryMap.$input.val( '' );
      jqueryMap.$input.focus();
    }
  };

  onLogin = function ( event, login_user ) {
    configMap.set_chat_anchor( 'opened' );
  };

  onLogout = function ( event, logout_user ) {
    configMap.set_chat_anchor( 'closed' );
    jqueryMap.$title.text( 'Chat' );
    clearChat();
  };

  //-------------------- END EVENT HANDLERS --------------------

  //------------------- BEGIN PUBLIC METHODS -------------------
  // Begin public method /configModule/
  // Example   : battleship.chat.configModule({ slider_open_em : 18 });
  // Purpose   : Configure the module prior to initialization
  // Arguments :
  //   * set_chat_anchor - a callback to modify the URI anchor to
  //     indicate opened or closed state. This callback must return
  //     false if the requested state cannot be met
  //   * chat_model - the chat model object provides methods
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
  // Example    : battleship.chat.initModule( $('#div_id') );
  // Purpose    :
  //   Directs Chat to offer its capability to the user
  // Arguments  :
  //   * $append_target (example: $('#div_id')).
  //     A jQuery collection that should represent
  //     a single DOM container
  // Action     :
  //   Appends the chat slider to the provided container and fills
  //   it with HTML content.  It then initializes elements,
  //   events, and handlers to provide the user with a chat-room
  //   interface
  // Returns    : true on success, false on failure
  // Throws     : none
  //
  initModule = function ( $append_target ) {
    var $list_box;

    // load chat slider html and jquery cache
    stateMap.$append_target = $append_target;
    $append_target.append( configMap.main_html );
    setJqueryMap();
    setPxSizes();

    // initialize chat slider to default title and state
    jqueryMap.$toggle.prop( 'title', configMap.slider_closed_title );
    stateMap.position_type = 'closed';

    // Have $list_box subscribe to jQuery global events
    $list_box = jqueryMap.$list_box;
    $.gevent.subscribe( $list_box, 'battleship-listchange', onListchange );
    $.gevent.subscribe( $list_box, 'battleship-setchatee',  onSetchatee  );
    $.gevent.subscribe( $list_box, 'battleship-updatechat', onUpdatechat );
    $.gevent.subscribe( $list_box, 'battleship-login',      onLogin      );
    $.gevent.subscribe( $list_box, 'battleship-logout',     onLogout     );

    // bind user input events
    jqueryMap.$head.bind(     'utap', onTapToggle );
    jqueryMap.$list_box.bind( 'utap', onTapList   );
    jqueryMap.$send.bind(     'utap', onSubmitMsg );
    jqueryMap.$form.bind(   'submit', onSubmitMsg );
  };
  // End public method /initModule/

  // Begin public method /removeSlider/
  // Purpose    :
  //   * Removes chatSlider DOM element
  //   * Reverts to initial state
  //   * Removes pointers to callbacks and other data
  // Arguments  : none
  // Returns    : true
  // Throws     : none
  //
  removeSlider = function () {
    // unwind initialization and state
    // remove DOM container; this removes event bindings too
    if ( jqueryMap.$slider ) {
      jqueryMap.$slider.remove();
      jqueryMap = {};
    }
    stateMap.$append_target = null;
    stateMap.position_type  = 'closed';

    // unwind key configurations
    configMap.chat_model      = null;
    configMap.people_model    = null;
    configMap.set_chat_anchor = null;

    return true;
  };
  // End public method /removeSlider/

  // Begin public method /handleResize/
  // Purpose    :
  //   Given a window resize event, adjust the presentation
  //   provided by this module if needed
  // Actions    :
  //   If the window height or width falls below
  //   a given threshold, resize the chat slider for the
  //   reduced window size.
  // Returns    : Boolean
  //   * false - resize not considered
  //   * true  - resize considered
  // Throws     : none
  //
  handleResize = function () {
    // don't do anything if we don't have a slider container
    if ( ! jqueryMap.$slider ) { return false; }

    setPxSizes();
    if ( stateMap.position_type === 'opened' ){
      jqueryMap.$slider.css({ height : stateMap.slider_opened_px });
    }
    return true;
  };
  // End public method /handleResize/

  // return public methods
  return {
    setSliderPosition : setSliderPosition,
    configModule      : configModule,
    initModule        : initModule,
    removeSlider      : removeSlider,
    handleResize      : handleResize
  };
  //------------------- END PUBLIC METHODS ---------------------
}());
