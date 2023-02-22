const express = require('express');
const app = express();
const cookieParser = require('cookie-parser')
const path = require('path');
const dotenv = require('dotenv')
dotenv.config()
app.use(express.json());
app.use(cookieParser())
var cors = require('cors');
app.use(cors({
  origin: 'https://web-portfolio-4y6tt2blds7g9x0.sel3.cloudtype.app',
  methods: ['GET', 'POST'],
  credentials: true,
}));
// app.use(cors())
app.use(express.urlencoded({ extended: true }));
var db;
const MongoClient = require('mongodb').MongoClient
MongoClient.connect(process.env.DB_URL, function (error, client) {
  if (error) { return console.log(error) }
  app.listen(process.env.PORT, function () {
    console.log(`listening on ${process.env.PORT}`)
  });
  db = client.db('portfolioDB')
});
app.use(express.static(path.join(__dirname, 'portfolio')));

// 데이터 api

app.get('/', function (req, resp) {
  req.sendFile(path.join(__dirname, '/portfolio/public/index.html'));
});

app.get('/api/product', function (req, resp) {
  db.collection('product').findOne({ _id: 0 }, function (error, result) {
    resp.json(result)
    console.log('프로덕트 데이터 전달 완료')
  })
});

app.post('/api/product', function (req, resp) {
  db.collection('product').updateOne({ _id: 0 }, { $set: req.body.product }, function () {
    db.collection('product').findOne({ _id: 0 }, function (error, result) {
      resp.status(200).json(result)
      console.log('프로덕트 데이터 교체 완료')
    })
  })
});

app.get('/api/lookbook', function (req, resp) {
  db.collection('lookbook').findOne({ _id: 0 }, function (error, result) {
    resp.json(result)
    console.log('룩북 데이터 전달 완료')
  })
});

app.get('/api/event', function (req, resp) {
  db.collection('event').findOne({ _id: 0 }, function (error, result) {
    resp.json(result)
    console.log('이벤트 데이터 전달 완료')
  })
});

app.post('/api/event', function (req, resp) {
  db.collection('event').updateOne({ _id: 0 }, { $set: req.body }, function (error, result) {
    console.log('이벤트 데이터 교체 완료')
  })
});

// 회원가입 api

app.post('/api/dupChk', function (req, resp) {
  db.collection('user').findOne({ id: req.body.userId }, function (error, result) {
    if (result) return resp.json(false)
    resp.json(true)
  })
});

app.post('/api/join', function (req, resp) {
  const coupon = [
    {
      name: "가입기념쿠폰",
      percentage: 10,
      period: "무기한"
    },
    {
      name: "취업성공기원",
      percentage: 25,
      period: "무기한"
    }
  ]
  db.collection('user').insertOne({ ...req.body.userData, coupon }, function (error, result) {
    console.log(req.body.userData.name + '님 회원가입 완료')
    resp.status(200).json({ coupon })
  })
});

// 로그인/로그아웃 api

const jwt = require('jsonwebtoken')

// 로그인 req 처리

app.post('/api/login', function (req, resp, next) {
  const { id, pw } = req.body
  db.collection('user').findOne({ id: id }, function (error, result) {
    if (!result) return resp.status(500).json(false)

    console.log(req.body)

    if (pw === result.pw) {
      const { pw, ...others } = result
      //엑세스 토큰 발급
      const accessToken = jwt.sign({
        id: result.id,
      }, 'accessSecret', {
        expiresIn: '1h',
        issuer: 'jyh'
      })
      //리프레시 토큰 발급
      const refreshToken = jwt.sign({
        id: result.id,
      }, 'refreshSecret', {
        expiresIn: '24h',
        issuer: 'jyh'
      })
      //토큰 전송
      resp.cookie('accessToken', accessToken, {
        secure: true, // 사용 프로토콜이 http인지 https에 따라 값을 설정
        httpOnly: true, // js에서 쿠키값에 접근 불가능하게 하는 옵션
        sameSite: 'none'
      })
      resp.cookie('refreshToken', refreshToken, {
        secure: true, // 사용 프로토콜이 http인지 https에 따라 값을 설정
        httpOnly: true, // js에서 쿠키값에 접근 불가능하게 하는 옵션
        sameSite: 'none'
      })
      resp.status(200).json(others)
      console.log(others.id + '님 로그인')
      next()
    }
    else {
      resp.status(500).json(false)
    }
  })
})

// 엑세스 토큰 검사

app.get('/api/accesstoken', function (req, resp) {
  const token = req.cookies.accessToken ? req.cookies.accessToken : null;
  const data = token ? jwt.verify(token, 'accessSecret') : null;
  if (data) {
    db.collection('user').findOne({ id: data.id }, function (error, result) {
      if (error || !result) return resp.status(500).json(false)
      const { pw, ...others } = result
      resp.status(200).json(others)
    })
  }
  else {
    return resp.status(500).json(false)
  }
})

// 리프레시 토큰 검사

app.get('/api/refreshtoken', function (req, resp) {
  // 용도 : access token 갱신
  const token = req.cookies.refreshToken
  const data = jwt.verify(token, 'refreshSecret');
  db.collection('user').findOne({ id: data.id }, function (error, result) {
    if (!result) return resp.status(500).json(error)
    //access token 새로 발급
    const { pw, ...others } = result
    const accessToken = jwt.sign({
      id: result.id,
      // pw: result.pw
    }, 'accessSecret', {
      expiresIn: '1h',
      issuer: 'jyh'
    })
    resp.cookie('accessToken', accessToken, {
      secure: true, // 사용 프로토콜이 http인지 https에 따라 값을 설정
      httpOnly: true, // js에서 쿠키값에 접근 불가능하게 하는 옵션
      sameSite: 'none'
    })
    resp.status(200).json(others)
  })
})

// 로그인 성공 resp

app.get('/api/login/success', function (req, resp) {
  //
  const token = req.cookies.accessToken;
  const data = jwt.verify(token, 'accessSecret');
  db.collection('user').findOne({ id: data.id }, function (error, result) {
    if (!result) return resp.status(500).json(error)
    result.status(200).json(result)
  })
})

// 로그아웃 req 처리

app.post('/api/logout', function (req, resp) {
  const token = req.cookies.accessToken
  const data = jwt.verify(token, 'accessSecret');
  try {
    console.log(data.id + '님 로그아웃')
    resp.cookie('accessToken', '', {
      secure: true, // 사용 프로토콜이 http인지 https에 따라 값을 설정
      httpOnly: true, // js에서 쿠키값에 접근 불가능하게 하는 옵션
      sameSite: 'none'
    })
    resp.status(200).json('logout success')
  }
  catch (error) {
    resp.status(500).json(error)
  }
})

// 유저 데이터 수정

app.post('/api/addcart', function (req, resp) {
  const token = req.cookies.accessToken;
  const data = jwt.verify(token, 'accessSecret');
  db.collection('user').updateOne({ id: data.id }, { $set: { cart: req.body.cart } }, function () {
    db.collection('user').findOne({ id: data.id }, function (error, result) {
      if (error || !result) return resp.json(false)
      const { pw, ...others } = result
      resp.status(200).json(others)
    })
  })
})

app.post('/api/like', function (req, resp) {
  const token = req.cookies.accessToken;
  const data = jwt.verify(token, 'accessSecret');
  db.collection('user').updateOne({ id: data.id }, { $set: { like: req.body.like } }, function () {
    db.collection('user').findOne({ id: data.id }, function (error, result) {
      if (error || !result) return resp.json(false)
      const { pw, ...others } = result
      resp.status(200).json(others)
    })
  })
})

// 문의글 쓰기

app.post('/api/cswrite', function (req, resp) {
  db.collection('postCount').updateOne({ _id: 0 }, { $inc: { count: 1 } }, function () {
    db.collection('postCount').findOne({ _id: 0 }, function (error, result) {
      if (error) return resp.status(500).json(false)
      const count = result.count
      db.collection('post').insertOne({ _id: count, ...req.body.postData }, function () {
        resp.status(200).json('write success')
      })
    })
  })
})

// 문의글 내역 불러오기

app.get('/api/cshistory', function (req, resp) {
  const token = req.cookies.accessToken;
  const data = jwt.verify(token, 'accessSecret');
  db.collection('user').findOne({ id: data.id }, function (error, result) {
    if (error || !result) return resp.status(500).json(error)
    db.collection('post').find({ id: data.id }).toArray(function (error, result) {
      resp.status(200).json(result)
    })
  })
})

// 문의글 수정

app.post('/api/csedit', function (req, resp) {
  const token = req.cookies.accessToken;
  const data = jwt.verify(token, 'accessSecret');
  db.collection('user').findOne({ id: data.id }, function (error, result) {
    if (error || !result) return resp.status(500).json(error)
    db.collection('post').updateOne({ _id: req.body.editData._id }, { $set: req.body.editData }, function () {
      resp.status(200).json('edit success')
    })
  })
})

// 문의글 삭제

app.post('/api/csdelete', function (req, resp) {
  const token = req.cookies.accessToken;
  const data = jwt.verify(token, 'accessSecret');
  db.collection('user').findOne({ id: data.id }, function (error, result) {
    if (error || !result) return resp.status(500).json(error)
    db.collection('post').deleteOne({ _id: req.body._id }, function () {
      resp.status(200).json('delete success')
    })
  })
})