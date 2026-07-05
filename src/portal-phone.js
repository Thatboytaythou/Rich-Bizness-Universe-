const OLD_PHONE_SELECTORS = '#phoneHub,.rb-phone-hub,.phone-shell,#phoneScreen,#phoneAvatar,[data-phone]';

function removeOldPhone() {
  document.querySelectorAll(OLD_PHONE_SELECTORS).forEach((el) => {
    el.remove();
  });
}

removeOldPhone();
requestAnimationFrame(removeOldPhone);
setTimeout(removeOldPhone, 100);
setTimeout(removeOldPhone, 400);
setTimeout(removeOldPhone, 1200);

export {};
