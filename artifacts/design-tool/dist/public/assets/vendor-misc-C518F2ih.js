(function(){
  if("serviceWorker" in navigator){
    navigator.serviceWorker.getRegistrations().then(function(r){
      r.forEach(function(reg){reg.unregister()});
    });
  }
  if(typeof caches!=="undefined"){
    caches.keys().then(function(k){
      k.forEach(function(n){caches.delete(n)});
    });
  }
  setTimeout(function(){location.reload()},500);
})();
