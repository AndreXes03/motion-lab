// Copyright Andrea Salvo. Framevolve Free Use License (see repository LICENSE).
// Direct Cycles API host. No Blender, Python runtime, bpy, or GUI is linked.
#include <atomic>
#include <filesystem>
#include <iostream>
#include <sstream>
#include <OpenColorIO/OpenColorIO.h>
#include <OpenImageIO/imageio.h>
#include "app/cycles_xml.h"
#include "device/device.h"
#include "scene/camera.h"
#include "scene/integrator.h"
#include "scene/pass.h"
#include "scene/scene.h"
#include "session/buffers.h"
#include "session/output_driver.h"
#include "session/session.h"
#include "util/log.h"
#include "util/path.h"
#include "util/progress.h"
using namespace ccl;
namespace OCIO = OCIO_NAMESPACE;
static std::string quoted(const std::string &s) {
  std::string r="\"";
  for (unsigned char c:s) { if(c=='"'||c=='\\') r+='\\'; if(c>=32) r+=c; }
  return r+'"';
}
static void event(const std::string &s) { std::cout << "MOTION_CYCLES " << s << std::endl; }
class Output final: public OutputDriver {
 public:
  std::string file, error;
  bool written=false;
  OCIO::ConstCPUProcessorRcPtr color;
  Output(std::string f, const std::string &config):file(std::move(f)) {
    auto cfg=OCIO::Config::CreateFromFile(config.c_str());
    auto view=OCIO::DisplayViewTransform::Create();
    view->setSrc("Linear Rec.709"); view->setDisplay("sRGB"); view->setView("Filmic");
    auto look=OCIO::LookTransform::Create();
    look->setSrc("Linear Rec.709"); look->setDst("Linear Rec.709"); look->setLooks("Medium High Contrast");
    auto group=OCIO::GroupTransform::Create(); group->appendTransform(look); group->appendTransform(view);
    color=cfg->getProcessor(group)->getDefaultCPUProcessor();
  }
  void write_render_tile(const Tile &tile) override {
    if (!(tile.size==tile.full_size)) { error="Unexpected tiled output"; return; }
    try {
      const int w=tile.size.x,h=tile.size.y;
      std::vector<float> pixels(w*h*4), flipped(w*h*4);
      if(!tile.get_pass_pixels("combined",4,pixels.data())) throw std::runtime_error("Combined pass missing");
      // Cycles combined is premultiplied; PNG is straight alpha. Grade straight RGB only.
      for(int i=0;i<w*h;i++) {
        float *p=&pixels[i*4]; const float a=p[3];
        if(a>1e-8f) { p[0]/=a; p[1]/=a; p[2]/=a; } else p[0]=p[1]=p[2]=0;
        color->applyRGB(p);
      }
      for(int y=0;y<h;y++) std::copy_n(&pixels[y*w*4],w*4,&flipped[(h-1-y)*w*4]);
      auto out=OIIO::ImageOutput::create(file);
      OIIO::ImageSpec spec(w,h,4,OIIO::TypeDesc::UINT8);
      spec.attribute("oiio:ColorSpace","sRGB"); spec.attribute("oiio:UnassociatedAlpha",1);
      if(!out||!out->open(file,spec)||!out->write_image(OIIO::TypeDesc::FLOAT,flipped.data())||!out->close())
        throw std::runtime_error("Could not write output PNG");
      written=true;
    } catch(const std::exception &e) { error=e.what(); }
  }
};
int main(int argc, const char **argv) {
 try {
  log_init(nullptr);
  const auto base=std::filesystem::canonical(argv[0]).parent_path().string();
  path_init(base);
  const auto devices=Device::available_devices();
  if(argc==2 && std::string(argv[1])=="--probe") {
    std::ostringstream out; out << "{\"protocol\":1,\"backend\":\"cycles-standalone\",\"revision\":\"a456b761034dda42c32eef9f4aae0fa5a5c9f604\",\"devices\":[";
    bool first=true;
    for(const auto &d:devices) { if(d.type!=DEVICE_CPU && d.type!=DEVICE_METAL) continue;
      if(!first) out<<","; first=false;
      out<<"{\"type\":"<<quoted(Device::string_from_type(d.type))<<",\"name\":"<<quoted(d.description)<<",\"id\":"<<quoted(d.id)<<"}";
    }
    out<<"]}"; event(out.str()); return 0;
  }
  if(argc!=6) throw std::runtime_error("Usage: framevolve-cycles scene.xml output.png CPU|METAL samples config.ocio; or --probe");
  const auto type=Device::type_from_string(argv[3]);
  auto selected=std::find_if(devices.begin(),devices.end(),[&](const auto &d){return d.type==type;});
  if(selected==devices.end()||(type!=DEVICE_CPU&&type!=DEVICE_METAL)) throw std::runtime_error("Requested device unavailable");
  const int samples=std::stoi(argv[4]); if(samples<1||samples>4096) throw std::runtime_error("Invalid sample count");
  SessionParams params; params.background=true; params.headless=true; params.samples=samples;
  params.device=*selected; params.denoise_device=*selected; params.use_auto_tile=false;
  SceneParams sceneParams;
  Session session(params,sceneParams);
  xml_read_file(session.scene.get(),argv[1]);
  auto *camera=session.scene->camera; camera->compute_auto_viewplane();
  BufferParams buffer; buffer.width=buffer.full_width=camera->get_full_width(); buffer.height=buffer.full_height=camera->get_full_height();
  if(buffer.width<1||buffer.height<1) throw std::runtime_error("Invalid image size");
  Pass *pass=session.scene->create_node<Pass>(); pass->set_name(ustring("combined")); pass->set_type(PASS_COMBINED);
  if(session.scene->integrator->get_use_denoise()) pass->set_mode(PassMode::DENOISED);
  auto output=make_unique<Output>(argv[2],argv[5]); auto *check=output.get(); session.set_output_driver(std::move(output));
  std::atomic<int> last{-1};
  session.progress.set_update_callback([&]{
    int p=int(session.progress.get_progress()*100);
    if(last.exchange(p)!=p) event("{\"type\":\"progress\",\"phase\":\"tracing\",\"percent\":"+std::to_string(p)+"}");
  });
  event("{\"type\":\"device\",\"backend\":\"cycles-standalone\",\"device\":"+quoted(Device::string_from_type(type))+",\"name\":"+quoted(selected->description)+"}");
  session.reset(params,buffer); session.start(); session.wait();
  if(session.progress.get_error()) throw std::runtime_error(session.progress.get_error_message());
  if(!check->error.empty()||!check->written) throw std::runtime_error(check->error.empty()?"No image written":check->error);
  return 0;
 } catch(const std::exception &e) { std::cerr<<e.what()<<std::endl; return 1; }
}
