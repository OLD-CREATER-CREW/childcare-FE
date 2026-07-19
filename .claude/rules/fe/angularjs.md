---
paths:
  - "public/**"
  - "!public/assets/**"
  - "!public/js/angular-*"
  - "!public/js/modules/**"
  - "!public/**/dist/**"
  - "!public/**/vendor/**"
---

# Frontend Convention (AngularJS 1.x + Express)

> **적용 대상**: AngularJS 1.x FE 보일러플레이트(EOL 2022). 사내 프로젝트는 도메인 모듈이 `public/<도메인>/{controllers,factory,views}/`로 분산되는 패턴이 일반적이라 `paths:`를 `public/**`로 잡되, 벤더(Metronic·assets·angular 코어 등)는 제외합니다. 도메인 분포는 프로젝트마다 실측 필요(가정 금지).
> 본 컨벤션은 `public/` 하위(FE)에만 적용. BE 영역(`index.js`, `lib/`, `routes/`, `server/`, `bin/`)은 `be-convention-express.md` 참조.
> **복사 시 파일명**: `fe-convention.md`
> **보안**: `fe-secure-coding.md` 참조 (혼합 스택의 BE 영역은 `be-secure-coding.md` 별도 참조)

## Quick Rules

> 대표 규칙만. 상세·예외·근거는 본문 참조.

| 상황                                  | 수준       | 규칙                                                                                                       |
| ------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------- |
| Controller/Service/Factory 신규 정의  | MUST       | strict DI (배열 표기 또는 `$inject`)                                                                       |
| `$interval`/`$watch`/외부 리스너 등록 | MUST       | `$scope.$on('$destroy', ...)`로 해제                                                                       |
| `$watch` 사용 시                      | SHOULD     | deep(3번째 인자 `true`) 신중. `$watchCollection` 우선 검토                                                 |
| 신규 controller 파일 생성             | MAY        | controllerAs 패턴 검토 (강제 X)                                                                            |
| `ng-model` 바인딩                     | SHOULD     | 객체 속성으로 (`ng-model="form.name"`, primitive 직접 바인딩 지양)                                         |
| `$scope.$apply` 신규 사용             | SHOULD NOT | `$timeout(0)` 또는 자동 처리에 위임                                                                        |
| jQuery DOM 조작 신규 추가             | SHOULD NOT | `angular.element` 또는 directive 사용                                                                      |
| 신규 directive 추가                   | SHOULD NOT | 새 기능용. 단, 기존 directive 패턴 따라가는 패치성 추가는 예외                                             |
| `ng-repeat` 사용 시                   | SHOULD     | 고유 id 있으면 `track by id` 명시                                                                          |
| 신규 API 호출 위치                    | MUST       | `public/factory/`에 도메인별 factory 정의. controller에서 `$http` 직접 호출 X                              |
| 신규 API 응답 처리                    | SHOULD     | `.then(success, error)` 또는 `.then().catch()`. `.success/.error`도 1.4.7에선 동작하지만 표준 Promise 권장 |
| 신규 디버그 로그                      | SHOULD NOT | `console.log` 신규 추가 X. 필요하면 `$log` 서비스                                                          |
| 코드 작성 스타일                      | SHOULD     | **프로젝트 우세 패턴** 따름                                                                                |
| minify 빌드                           | MUST       | `ng-strict-di` 적용                                                                                        |

## 용어 정의

본 문서의 "신규/기존/패치/리팩터링"은 이렇게 구분합니다:

- **기존 코드**: 이미 작성·커밋된 controller/service/directive/모듈
- **기존 파일에 추가**: 기존 파일 안에서 함수·블록을 새로 추가하거나 기존 함수를 수정 → **기존 코드 취급** (우세 패턴 따름)
- **신규 파일**: 빈 `.js` 파일을 새로 만들어 controller/service/directive를 첫 정의 → **신규 취급** (개선 패턴 적용)
- **신규 모듈**: `angular.module(...)`을 새로 등록 → 사실상 거의 발생하지 않음
- **패치**: 보안/버그 수정 목적의 변경 (기능 추가 아님)
- **리팩터링**: 동작 동일·구조만 개선. 본 문서에선 패치 외 즉흥적 리팩터링 금지 (핵심 철학 5)

## 핵심 철학

1. **레거시 유지 우선** — 보안·버그 패치가 주된 변경 사유
2. **기존 코드는 그대로** — 갑작스러운 제거·리팩터링 금지
3. **신규 작성 단위에서만 개선 패턴 적용** — strict DI, controllerAs 등은 빈 파일에서 시작할 때
4. **지나가다 리팩터링 금지** — 패치 외 즉흥적 개선은 별도 MR
5. **부채 표시**: `// TODO: fe-convention-angularjs 전환 (JIRA-XXX)` 주석 추적

## 프로젝트 구조 (사내 AngularJS 보일러플레이트 공통)

> 사내 AngularJS+Express 보일러플레이트 기반 프로젝트가 다수 존재. 공통 베이스를 공유하지만 **도메인 모듈 수와 일부 세부 패턴은 프로젝트마다 다름**. 적용 시 실측 권장.

```
bin/             - 시작 스크립트              ← BE (be-convention-express.md)
index.js         - express 진입점              ← BE
lib/             - 백엔드 헬퍼                  ← BE
routes/          - express 라우트                ← BE
server/          - 서버 모듈 (있는 경우)         ← BE
public/                                          ← FE (본 문서 적용 대상)
  index.html     - ng-app="<App>" 진입점
  js/
    main.js      - angular.module 정의 (의존성 등록)
    config.js    - $stateProvider 라우트 설정 (있는 경우)
    directives.js - 커스텀 directive
    commonService.js - 공통 service (있는 경우)
    modules/     - 화면별 controller/template
  tpl/           - HTML 템플릿 파편
  stylesheets/
```

ng-app 모듈명만 다름 (GroupwareApp / ClickPublisherApp / sspVideoAdminApp 등). 핵심 의존성은 거의 동일 (`ui.router`, `ngCookies`, `ui.bootstrap`, `oc.lazyLoad`, `ngSanitize`).

## DI / 컴포넌트

### strict DI — 신규 한정 [MUST]

신규 controller/service/factory는 배열 표기 또는 `$inject` 사용 (AngularJS 1.0+ 공식 권장).

```js
// 권장 (배열 표기)
.controller('FooController', ['$scope', '$http', function($scope, $http) {
  ...
}])

// 권장 ($inject 방식)
function FooController($scope, $http) { ... }
FooController.$inject = ['$scope', '$http'];
.controller('FooController', FooController)

// 지양 (minify 시 DI 깨짐)
.controller('FooController', function($scope, $http) { ... })
```

**기존 loose DI 코드는 그대로 유지**. 프로젝트별로 혼재돼있어 신규만 strict로 일관 적용.

### `$interval`·`$watch`·외부 이벤트 리스너 등록 시 정리 [MUST]

ui.router state 전환 시 controller가 destroy되지 않으면 리스너가 중복 누적 → 메모리 누수.

```js
// 권장
.controller('FooCtrl', ['$scope', '$interval', function($scope, $interval) {
  var timer = $interval(tick, 1000);

  $scope.$on('$destroy', function() {
    $interval.cancel(timer);
  });
}])

// 지양 ($destroy 처리 없이 등록만)
.controller('FooCtrl', ['$scope', '$interval', function($scope, $interval) {
  $interval(tick, 1000);
}])
```

대상: `$interval`, 장기 실행 `$timeout`, `$rootScope.$on`, DOM 이벤트 리스너, 외부 라이브러리 구독(socket 등).

### `$watch` 사용 시 deep watch 신중 [SHOULD]

3번째 인자 `true`(deep)는 큰 객체면 매 digest마다 성능 폭탄. 우선 대안 검토:

```js
// 지양 (큰 객체에 deep watch)
$scope.$watch("user", fn, true);

// 권장 (얕은 1단계 감지로 충분하면)
$scope.$watchCollection("user.tags", fn);
```

특정 필드만 필요하면 `$scope.$watch('user.name', fn)`. 변경 트리거가 명확하면 `$broadcast` 이벤트로 대체.

### 신규 controller 파일에서 controllerAs 패턴 검토 [MAY]

기존 우세 패턴은 `$scope`. 신규 파일 한정으로 controllerAs 검토 가능. 강제 X.

#### 두 패턴 비교

**`$scope` 패턴 (기존 우세, 사내 AngularJS 보일러플레이트 표준)**:

```js
.controller('UserCtrl', ['$scope', function($scope) {
  $scope.user = { name: '홍길동' };
}])
```

```html
<div ng-controller="UserCtrl">{{user.name}}</div>
```

**`controllerAs` 패턴 (1.2+ 도입)**:

```js
.controller('UserCtrl', [function() {
  var vm = this;
  vm.user = { name: '홍길동' };
}])
```

```html
<div ng-controller="UserCtrl as vm">{{vm.user.name}}</div>
```

#### 차이

- `vm.x`로 출처 명시 — 어떤 controller에서 온 변수인지 템플릿에서 바로 보임
- `$scope` 의존도 ↓ — `this` 사용으로 controller가 일반 객체에 가까워짐
- **점 표기 강제 → `$scope` 상속 함정 회피** — 자식 scope(ng-if/ng-repeat 내부)에서 primitive 바인딩 끊김 방지

> 기존 controller에 코드 추가는 `$scope` 유지. 빈 파일에서 시작할 때만 controllerAs 검토.

### `$scope.$apply` / `$rootScope.$apply` 신규 사용 [SHOULD NOT]

```js
// 지양
$scope.$apply(function () {
  $scope.data = newData;
});

// 권장 — AngularJS 컨텍스트 안이면 자동 적용
// (이벤트 핸들러, $http 콜백, $timeout 등)
$scope.data = newData;

// 권장 — 외부 콜백에서 변경하려면 $timeout
$timeout(function () {
  $scope.data = newData;
}, 0);
```

**기존 `$apply` 호출은 그대로**. 다음 신호 발생 시에만 `$timeout(0)`로 교체:

- `$digest already in progress` 콘솔 에러
- `$apply` 안에서 또 다른 `$apply` 호출 (중첩)

> **외부 콜백은 유지 필수**: `socket.io`, 3rd party 위젯, `setTimeout`, jQuery 이벤트 등 AngularJS 컨텍스트 밖에서 들어오는 콜백 안의 `$apply`는 화면 갱신을 위해 반드시 필요. 무지성 제거 시 데이터는 바뀌었는데 화면이 안 갱신되는 회귀 발생.

### jQuery DOM 조작 신규 추가 [SHOULD NOT]

```js
// 지양
$('#user-name').text(userName);
$('.btn').on('click', handler);

// 권장 — AngularJS 디렉티브로
// HTML: <span>{{userName}}</span>, <button ng-click="handler()">

// 권장 — directive 안에서 angular.element (jqLite)
.directive('myDir', function() {
  return {
    link: function(scope, element) {
      element.on('click', handler);
    }
  };
})
```

**기존 jQuery 코드는 그대로**. 실제 버그 유발 시에만 교체.

### 신규 directive 추가 [SHOULD NOT]

신규 directive는 기본 추가하지 않음. 단 다음은 예외:

- 보안 패치를 위해 기존 directive에 **동일 패턴으로 추가**
- 명백한 버그 수정 목적의 directive 분리

새 기능용 directive 추가는 본 문서 범위 밖. 팀에서 별도 결정 필요.

## API 호출

### 호출 흐름

```
controller → factory.method(params) → factory에서 $http() → factory가 promise return → controller에서 .then으로 결과 처리
```

사내 AngularJS 보일러플레이트에서 이 패턴이 정착 (실측 시 controller에서 `$http` 직접 호출은 0회 또는 매우 드묾).

### service/factory 분리 [MUST]

신규 API 호출은 `public/factory/` 하위에 도메인별 factory 정의. controller에서 직접 `$http` 사용 X.

```js
// public/factory/AccountFactory.js
angular.module("AppName").factory("accountFactory", [
  "$http",
  "$cookieStore",
  "$rootScope",
  function ($http, $cookieStore, $rootScope) {
    var accountFactory = {};
    var urlBase = $rootScope.settings.appPath;
    var header = $cookieStore.get("sessionCookie").userHeader;

    accountFactory.getAccountList = function (params) {
      return $http({
        method: "get",
        url: urlBase + "accounts",
        headers: header,
        params: params,
      });
    };

    return accountFactory;
  },
]);
```

### 신규 응답 처리 [SHOULD]

`.success/.error`는 AngularJS 1.4.4에서 deprecated, 1.6에서 제거됐습니다. 사내 AngularJS 보일러플레이트는 **1.4.7 고정**(`public/assets/global/plugins/angularjs/angular.min.js`)이라 동작은 정상이지만 신규 코드는 표준 Promise API(`.then/.catch`) 권장.

**중요**: 단순 치환 X. `.success`는 data 직접 받지만 `.then`은 response 객체 한 겹 더 거침.

```js
// 권장 (신규)
accountFactory.getAccountList(params).then(
  function (response) {
    // response.data, response.status, response.headers(), response.config
    $scope.accounts = response.data.Accounts;
  },
  function (errorResponse) {
    // 에러 처리
  },
);

// 또는 .catch
accountFactory
  .getAccountList(params)
  .then(function (response) {
    /* ... */
  })
  .catch(function (errorResponse) {
    /* ... */
  });

// 기존 (deprecated, 동작은 OK)
accountFactory
  .getAccountList(params)
  .success(function (data) {
    $scope.accounts = data.Accounts; // data 직접
  })
  .error(function (data, status) {
    /* ... */
  });
```

기존 `.success/.error` 코드는 1.4.7에서 정상 동작 → 패치 작업 시 그대로 유지 (지나가다 리팩터링 금지, 핵심 철학 4).

### 공통 로직 [SHOULD]

인증 헤더, 공용 유틸(데이터 가공·localStorage 통합 관리 등)은 `public/factory/CommonService.js`(`commonService` factory)에 추가. HTTP Interceptor 도입 X (현 패턴 유지).

> 참고: `public/js/commonService.js`는 빈 파일 (보일러플레이트 잔재). 실제 위치는 `public/factory/CommonService.js`.

### 콜백 중첩 회피 [SHOULD]

여러 API 의존 호출은 `$q.all` 또는 promise chain으로 평탄화.

```js
// 지양 (콜백 중첩)
accountFactory.getAccount(id).then(function (res1) {
  mediaFactory.getMedia(res1.data.mediaId).then(function (res2) {
    // ...
  });
});

// 권장 (chain)
accountFactory
  .getAccount(id)
  .then(function (res1) {
    return mediaFactory.getMedia(res1.data.mediaId);
  })
  .then(function (res2) {
    /* ... */
  });

// 또는 병렬
$q.all([accountFactory.getAccount(id), mediaFactory.getMedia(mediaId)]).then(
  function (results) {
    var account = results[0].data;
    var media = results[1].data;
  },
);
```

### `$resource` 미사용

사내 AngularJS 보일러플레이트에서 `$resource` 사용은 실측 0회 (BE가 RESTful 아니고 URL 패턴 다양). `$http`만 사용. 신규 도입 X.

### 외부 BE (드림팩토리 등) 직접 호출 X

FE에서 드림팩토리 직접 호출 X. 자체 BE 라우트 경유. 자체 BE의 외부 API 호출 패턴은 `be-convention-express.md` 참조.

### 디버그 로그 [SHOULD NOT]

기존 코드에 `console.log` 다수 있지만 신규엔 추가 X. 필요하면 `$log` 서비스 사용 (production에서 비활성 가능).

```js
// 지양
console.log("data: ", data);

// 권장
$log.debug("data: ", data);
```

## 템플릿 패턴

### `ng-repeat` 사용 시 `track by` 명시 [SHOULD]

목록 갱신 후 DOM 깜빡임·포커스 손실·잘못된 row 바인딩 방지.

```html
<!-- 권장 (고유 id 있을 때) -->
<li ng-repeat="item in items track by item.id">{{item.name}}</li>

<!-- 지양 ($index track by는 항목 순서 바뀌면 식별 깨짐) -->
<li ng-repeat="item in items track by $index">{{item.name}}</li>

<!-- 권장 (id 없을 때만 기본 동작 유지) -->
<li ng-repeat="item in items">{{item.name}}</li>
```

기본 동작은 객체 참조 기반 추적. 고유 id가 있는데 명시 안 하면 매 갱신마다 DOM 재생성될 수 있음.

### `ng-model`은 객체 속성으로 (점 표기) [SHOULD]

`ng-if`, `ng-repeat`, `ng-switch` 등은 자식 scope를 만듦. primitive 직접 바인딩 시 자식 scope의 그림자(shadowing)로 부모 값이 갱신 안 됨.

```html
<!-- 지양 (자식 scope에서 name이 새로 생기고 부모 안 바뀜) -->
<div ng-if="show">
  <input ng-model="name" />
</div>

<!-- 권장 (form 객체 참조는 공유, name 갱신이 부모에도 반영) -->
<div ng-if="show">
  <input ng-model="form.name" />
</div>
```

```js
// controller에서 form 객체 초기화
$scope.form = { name: "" };
// 또는 controllerAs 패턴이면
vm.form = { name: "" };
```

**기존 버그 패치 시에도 자주 만남.** primitive 바인딩 발견되면 patch 단위에서 객체로 전환 검토.

## 코드 스타일

### 프로젝트 우세 패턴 따름 [SHOULD]

문법·들여쓰기·따옴표·세미콜론은 프로젝트의 **ESLint/Prettier config 또는 우세 스타일**을 따름. 같은 파일 내 일관성 우선.

신규 ESLint 룰 추가 [MAY NOT] — 사내 AngularJS 보일러플레이트의 카피베이스 관행상 파편화 유발.

신규 파일 만들 때만 본 문서의 권장 패턴 적용 (strict DI, controllerAs 등).

## 빌드 / 환경

### minify 환경에서 strict DI 검증 [MUST]

```html
<html ng-app="MyApp" ng-strict-di></html>
```

loose DI 사용 시 즉시 오류 (AngularJS 1.3+). 신규 작업 영역에서만 점진 전환.

## 코드 변경 시 체크리스트

- [ ] 신규 controller/service/factory가 strict DI 형식인가
- [ ] `$interval`/`$watch`/외부 리스너 등록 시 `$on('$destroy')`로 해제했는가
- [ ] `$watch` 추가 시 deep(`true`) 대신 `$watchCollection` 또는 특정 필드 watch로 대체 가능한가 검토했는가
- [ ] 신규 controller 파일을 새로 만들었으면 controllerAs 적용 검토 (기존 controller에 코드 추가는 `$scope` 유지)
- [ ] `$scope.$apply` / jQuery DOM 조작을 신규로 추가하지 않았는가
- [ ] `ng-repeat` 대상에 고유 id 있으면 `track by` 명시했는가
- [ ] `ng-model`이 자식 scope(ng-if/ng-repeat 안)에 있으면 객체 점 표기로 바인딩했는가
- [ ] 신규 API 호출은 `public/factory/`에 factory로 정의했는가 (controller 직접 `$http` X)
- [ ] 신규 응답 처리는 `.then/.catch` 사용했는가 (`response.data` 접근 패턴)
- [ ] 콜백 중첩 회피했는가 (`$q.all` / promise chain)
- [ ] 신규 코드에 `console.log` 추가하지 않았는가 (`$log` 사용)
- [ ] 변경 영역 외 코드를 즉흥적으로 리팩터링하지 않았는가
- [ ] 같은 파일 내 스타일(따옴표·들여쓰기) 일관성 유지했는가
- [ ] 변경 영역의 회귀 테스트 시나리오 확인했는가
- [ ] **보안 체크리스트는 `fe-secure-coding.md` 참조**
