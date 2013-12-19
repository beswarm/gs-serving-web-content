/**
 * Created by Administrator on 13-12-19.
 */

window.onload=getMyLocation;
function getMyLocation( ){
    if(navigator.geolocation  ){
        navigator.geolocation.getCurrentPosition(displayLocation );
    }else{
        alert("Oops, no geolocation support ");
    }
}


function displayLocation(position){
    var latitude=position.coords.latitude;
    var longitude=position.coords.longitude;

    var div=document.getElementById("location");
    div.innerHTML="You are at Latitude: " +latitude+", Longitude:"+longitude;
}