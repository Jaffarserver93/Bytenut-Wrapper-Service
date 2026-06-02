{pkgs}: {
  deps = [
    pkgs.xorg.xorgserver
    pkgs.alsa-lib
    pkgs.libgbm
    pkgs.mesa
    pkgs.libdrm
    pkgs.cups
    pkgs.at-spi2-atk
    pkgs.nss
    pkgs.xorg.libXtst
    pkgs.xorg.libXrandr
    pkgs.xorg.libXi
    pkgs.xorg.libXext
    pkgs.xorg.libXdamage
    pkgs.xorg.libXcursor
    pkgs.xorg.libXcomposite
    pkgs.xorg.libX11
    pkgs.xvfb-run
    pkgs.chromium
  ];
}
