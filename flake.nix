{
  inputs = {
    utils.url = "github:gytis-ivaskevicius/flake-utils-plus";
  };

  outputs = { nixpkgs, utils, ... }:
    utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        devShell = pkgs.mkShell {
          buildInputs = with pkgs; [
            (python3.withPackages (ps: with ps; [
              torch
              numpy
              transformers
              fastapi
              uvicorn
              pydantic
            ]))
          ];
        };

      });
}