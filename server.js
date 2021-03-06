'use strict';
const fs = require('fs');
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var basicAuth = require('basic-auth-connect');
var mysql = require('mysql');
var conf = require('./server/config');
var pool = mysql.createPool(conf);
var flowers = require('./server/Models/FlowersModel')(pool);
var events = require('./server/Models/EventsModel')(pool);
var compression = require('compression');
const nodemailer = require('nodemailer');

app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
app.set('views', __dirname + '/public/views');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(compression());
app.use(express.static(__dirname + '/public'));

app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST');
  res.header('Access-Control-Allow-Headers',
  'Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With');
  next();
});

///ГЛАВНАЯ
app.get('/', function (req, res) {
  res.render('index.ejs');
});

app.get('/leftActive', function (req, res) {
  events.GetEventsActive((error, data) => {
    if (!error)
      res.render('./partial/left_active.ejs', { data: data });
    else 
      console.log(error);
  })
});

app.get('/rightActive', function (req, res) {
  res.render('./partial/right_active.ejs');
});

app.get('/getBouquets', function (req, res) {
  flowers.GetBouquetsActive(function (error, data) {
    if (!error)
      res.render('./bouquet.ejs', { data: data });
    else 
      console.log(error);
  });
});

app.get('/getFlowers', function (req, res) {
  flowers.GetFlowersActive(function (error, data) {
    if (!error)
      res.render('./flowers.ejs', { data: data });
    else 
      console.log(error);
  });
});

app.post('/GetEventById', (req, res) => {
    if(req.body) {
      let id = req.body.id;
      
      events.GetEventById(id, (error, data) => {
          if (!error) {
            data[0].imagesArray = [];
            var path = './public/Downloads/Events/' + data[0].imagesFolderSrc + '/';
            fs.readdir(path, (err, files) => {
              data[0].imagesArray = files;

              res.json({ type: 'success', data: data[0] });
            })
          }
          else
            res.json({ type: 'error' });
      });
    } else {
      res.json({ type: 'error' });
    }  
});

app.post('/sendEmail', (req, res) => {
  //https://www.google.com/settings/security/lesssecureapps
  if(req.body) {
    let {fio, phone, mail, address, date, time} = req.body;

    let transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: conf.smtpEmail,
        pass: conf.smtpEmailPass,
      }
    });

    let body = `ФИО - ${fio} <br />
                Телефон - ${phone} <br />
                E-Mail - ${mail} <br />
                Адрес доставки - ${address} <br />
                Дата доставки - ${date} <br />
                Время доставки - ${time}<br />`;

    let options = {
      from: 'DesireEvent Mail Robot' + ' <DesireEvent007@gmail.com>',
      to: conf.managerEmail,
      subject: '(Доставка) Заказ букета с сайта DesireEvent',
      html: body,
    };

    transporter.sendMail(options, function(err, info) {
      if (err) {
        console.log(err);
        res.json({ type: 'error' });
      }

      console.log("Сообщение отправлено: " + info.response);
      res.json({ type: 'success' });
    });
  }
});

app.post('/sendEmail2', (req, res) => {
  if(req.body) {
    let {fio, phone, mail, address, date, time, isChecked, content } = req.body;

    let transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: 'DesireEvent007@gmail.com',
        pass: conf.managerEmailPass,
      }
    });

    let body = `ФИО - ${fio} <br />
                Телефон - ${phone} <br />
                E-Mail - ${mail} <br />
                Букет состоит из - ${content} <br />`;
    //Значит есть доставка
    if(isChecked === '1') {
      body += `Есть доставка <br />
               Адрес доставки - ${address} <br />
               Дата доставки - ${date} <br />
               Время доставки - ${time}<br />`;
    }

    let options = {
      from: 'DesireEvent Mail Robot' + ' <DesireEvent007@gmail.com>',
      to: conf.managerEmail,
      subject: 'Заказ букета с сайта DesireEvent',
      html: body,
    };

    transporter.sendMail(options, function(err, info) {
      if (err) {
        console.log(err);
        res.json({ type: 'error' });
      }

      console.log("Сообщение отправлено: " + info.response);
      res.json({ type: 'success' });
    });
  }
});

///АДМИНИСТРАТИВНАЯ ЧАСТЬ///
var auth = basicAuth(conf.siteAdminLogin, conf.siteAdminPassword);

///АДМИНКА
app.get('/flowers_admin/', auth, function (req, res) {
  res.render('admin.ejs');
});

app.get('/flowers_admin/save', auth, function (req, res) {
  res.render('./partial/admin_new.ejs');
});

app.post('/flowers_admin/save', auth, function (req, res) {
	if (req.body !== null) {
  		var obj = req.body;

  		if(obj.isActive === 'on') {
  			obj.isActive = 1;
  			obj.dateActivation = new Date();
  		} else {
  			obj.isActive = 0;
  		}

  		obj.id = Guid();
  		obj.dateCreate = new Date();

  		try {
			    flowers.Save( obj, function (error, data) {
		        if (!error)
		          res.json({ type: 'success' });
		        else
		          res.json({ type: 'error' });
	      	});
  		} catch(e) {
		    console.log(e);
		    res.json({ type: 'error' });
		  }
  	} else {
  		res.json({ type: 'error' });
  	}
});

app.get('/flowers_admin/get', auth, function (req, res) {
  try {
    flowers.Get(function (error, data) {
      if (!error) {
        res.render('./partial/admin_list.ejs', { flowers: data });
      }
      else
        return null;
    })
  } catch(e) {
    return null;
  }
});

app.post('/flowers_admin/SaveChange', auth, function (req, res) {
  try {
    if (req.body !== null) {
      var obj = req.body;
      var isA = Number(obj.isActive);
      
      if(isA === 1)
        obj.dateActivation = new Date();
      else
        obj.dateActivation = null;

      flowers.SaveChange([isA, obj.dateActivation, obj.id], function (error, data) {
          if (!error)
            res.json({ type: 'success' });
          else
            res.json({ type: 'error' });
      });
    } else {
      res.json({ type: 'error' });
    }
  } catch(e) {
    res.json({ type: 'error' });
  }
});

app.post('/flowers_admin/Delete', auth, function (req, res) {
  try {
    if (req.body !== null) {
      var obj = req.body;

      flowers.Delete(obj.id, function (error, data) {
          if (!error)
            res.json({ type: 'success' });
          else
            res.json({ type: 'error' });
      });
    } else {
      res.json({ type: 'error' });
    }
  } catch(e) {
    res.json({ type: 'error' });
  }
});

///////// ЦВЕТЫ //////////
app.get('/flowers_admin/newFlower', auth, function (req, res) {
  res.render('./partial/admin_newFlower.ejs');
});

app.post('/flowers_admin/newflower', auth, function (req, res) {
  if (req.body !== null) {
      var obj = req.body;

      if(obj.isActive === 'on') {
        obj.isActive = 1;
        obj.dateActivation = new Date();
      } else {
        obj.isActive = 0;
      }

      obj.id = Guid();
      obj.dateCreate = new Date();

      try {
          flowers.SaveFlower( obj, function (error, data) {
            if (!error)
              res.json({ type: 'success' });
            else
              res.json({ type: 'error' });
          });
      } catch(e) {
        console.log(e);
        res.json({ type: 'error' });
      }
    } else {
      res.json({ type: 'error' });
    }
})

app.get('/flowers_admin/getFlowers', auth, function (req, res) {
  try {
    flowers.getFlowers(function (error, data) {
      if (!error) {
        res.render('./partial/admin_listFowers.ejs', { flowers: data });
      }
      else
        return null;
    })
  } catch(e) {
    return null;
  }
});

app.post('/flowers_admin/SaveChangeFlower', auth, function (req, res) {
  try {
    if (req.body !== null) {
      var obj = req.body;
      var isA = Number(obj.isActive);
      
      if(isA === 1)
        obj.dateActivation = new Date();
      else
        obj.dateActivation = null;

      flowers.SaveChangeFlower([isA, obj.dateActivation, obj.id], function (error, data) {
          if (!error)
            res.json({ type: 'success' });
          else
            res.json({ type: 'error' });
      });
    } else {
      res.json({ type: 'error' });
    }
  } catch(e) {
    res.json({ type: 'error' });
  }
});

app.post('/flowers_admin/DeleteFlower', auth, function (req, res) {
  try {
    if (req.body !== null) {
      var obj = req.body;

      flowers.DeleteFlower(obj.id, function (error, data) {
          if (!error)
            res.json({ type: 'success' });
          else
            res.json({ type: 'error' });
      });
    } else {
      res.json({ type: 'error' });
    }
  } catch(e) {
    res.json({ type: 'error' });
  }
});

//СОБЫТИЯ//
app.get('/flowers_admin/newEvent', auth, function (req, res) {
  res.render('./partial/admin_newEvent.ejs');
});

app.post('/flowers_admin/newEvent', auth, function (req, res) {
  if (req.body !== null) {
      var obj = req.body;

      if(obj.isActive === 'on') {
        obj.isActive = 1;
        obj.dateActivation = new Date();
      } else {
        obj.isActive = 0;
      }

      obj.id = Guid();
      obj.dateCreate = new Date();

      try {
          events.Save( obj, function (error, data) {
            if (!error)
              res.json({ type: 'success' });
            else
              res.json({ type: 'error' });
          });
      } catch(e) {
        console.log(e);
        res.json({ type: 'error' });
      }
    } else {
      res.json({ type: 'error' });
    }
});

app.get('/flowers_admin/getEvents', auth, function (req, res) {
  try {
    events.getEvents(function (error, data) {
      if (!error) {
        res.render('./partial/admin_listEvents.ejs', { data: data });
      }
      else
        return null;
    })
  } catch(e) {
    return null;
  }
});

app.post('/flowers_admin/SaveChangeEvent', auth, function (req, res) {
  try {
    if (req.body !== null) {
      var obj = req.body;
      var isA = Number(obj.isActive);
      
      if(isA === 1)
        obj.dateActivation = new Date();
      else
        obj.dateActivation = null;

      events.SaveChangeEvent([isA, obj.dateActivation, obj.id], function (error, data) {
          if (!error)
            res.json({ type: 'success' });
          else
            res.json({ type: 'error' });
      });
    } else {
      res.json({ type: 'error' });
    }
  } catch(e) {
    res.json({ type: 'error' });
  }
});

app.post('/flowers_admin/DeleteEvent', auth, function (req, res) {
  try {
    if (req.body !== null) {
      var obj = req.body;

      events.DeleteEvent(obj.id, function (error, data) {
          if (!error)
            res.json({ type: 'success' });
          else
            res.json({ type: 'error' });
      });
    } else {
      res.json({ type: 'error' });
    }
  } catch(e) {
    res.json({ type: 'error' });
  }
});

function Guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  };

  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
};

app.listen(8081, function () {
  console.log('Server successfully started on 8081 port');
});
