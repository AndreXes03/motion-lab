# Applied inside the pinned Cycles src/app directory after its native target.
add_executable(framevolve-cycles "${FRAMEVOLVE_HOST_SOURCE}" cycles_xml.cpp)
target_link_libraries(framevolve-cycles PRIVATE ${LIB} OpenColorIO::OpenColorIO)
cycles_install_libraries(framevolve-cycles)
install(TARGETS framevolve-cycles DESTINATION ${CMAKE_INSTALL_PREFIX})
